const os = require('os');
const fs = require('fs');
const express = require('express');

const { pool, initDatabase } = require('./database/db');
const expedienteRoutes = require('./routes/expedienteRoutes');
const { iniciarOutboxWorker, detenerOutboxWorker } = require('./workers/outboxWorker');
const app = express();
const PORT = process.env.PORT || 3003;

// Nombre de la réplica = hostname del contenedor (su ID corto en Docker)
const REPLICA = os.hostname();
// Si este archivo existe, /health responde 503 aunque el proceso siga vivo.
// Sirve para simular una réplica "viva pero enferma" en la demo:
//   docker exec doctu-servicio-expedientes-1 touch /tmp/doctu-no-sano
const ARCHIVO_FALLA_SIMULADA = process.env.HEALTH_FAIL_FILE || '/tmp/doctu-no-sano';

let apagando = false;

// Cada respuesta indica qué réplica la atendió (equivale a X-Instancia del lab S07)
app.use((req, res, next) => {
  res.setHeader('X-Served-By', REPLICA);
  next();
});

app.use(express.json());

/*
 * Health check que consulta el balanceador del gateway cada 5s.
 * Responde 200 solo si la réplica puede atender de verdad: no se está apagando,
 * no tiene una falla simulada y alcanza a su base PostgreSQL.
 */
app.get('/health', async (req, res) => {
  const base = { service: 'servicio-expedientes', replica: REPLICA, timestamp: new Date().toISOString() };

  if (apagando) {
    return res.status(503).json({ ...base, status: 'shutting_down' });
  }
  if (fs.existsSync(ARCHIVO_FALLA_SIMULADA)) {
    return res.status(503).json({ ...base, status: 'unhealthy', motivo: `Falla simulada (${ARCHIVO_FALLA_SIMULADA})` });
  }

  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ ...base, status: 'ok', database: 'ok' });
  } catch (err) {
    return res.status(503).json({ ...base, status: 'unhealthy', database: err.message });
  }
});

app.use('/', expedienteRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    mensaje: 'Ruta de expedientes no encontrada.'
  });
});

app.use((err, req, res, next) => {
  console.error('[Error en Servicio Expedientes]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    mensaje: 'Error procesando expedientes.'
  });
});

/*
 * Apagado ordenado. Node corre como PID 1 en el contenedor y PID 1 ignora SIGTERM si
 * no hay un manejador: sin esto, `docker stop` espera 10s y termina con SIGKILL.
 * Con el manejador: deja de aceptar conexiones nuevas (el gateway pasa a la otra
 * réplica), termina las peticiones en curso, detiene el outbox worker y cierra el pool.
 */
function apagar(server, senal) {
  if (apagando) return;
  apagando = true;
  console.log(`[Microservicio Expedientes ${REPLICA}] ${senal} recibido: apagado ordenado...`);

  detenerOutboxWorker();
  server.close(async () => {
    await pool.end().catch(() => {});
    console.log(`[Microservicio Expedientes ${REPLICA}] Apagado completo.`);
    process.exit(0);
  });

  // Red de seguridad: si algo se queda colgado, salir antes del SIGKILL de Docker
  setTimeout(() => process.exit(1), 8000).unref();
}

// Primero se prepara el esquema en PostgreSQL; solo entonces se aceptan peticiones.
initDatabase()
  .then(() => {
    const server = app.listen(PORT, () => {
      iniciarOutboxWorker();
      console.log(`\n=================================================`);
      console.log(`[Microservicio Expedientes] Réplica ${REPLICA} activa en puerto ${PORT}`);
      console.log(`=================================================\n`);
    });

    process.on('SIGTERM', () => apagar(server, 'SIGTERM'));
    process.on('SIGINT', () => apagar(server, 'SIGINT'));
  })
  .catch((err) => {
    console.error('[Microservicio Expedientes] No se pudo inicializar PostgreSQL:', err);
    process.exit(1);
  });
