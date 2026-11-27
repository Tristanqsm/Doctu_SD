const express = require('express');

const { initDatabase } = require('./database/db');
const expedienteRoutes = require('./routes/expedienteRoutes');
const { iniciarOutboxWorker } = require('./workers/outboxWorker');
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'servicio-expedientes',
    timestamp: new Date().toISOString()
  });
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

// Primero se prepara el esquema en PostgreSQL; solo entonces se aceptan peticiones.
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      iniciarOutboxWorker();
      console.log(`\n=================================================`);
      console.log(`[Microservicio Expedientes] Activo y escuchando en puerto ${PORT}`);
      console.log(`=================================================\n`);
    });
  })
  .catch((err) => {
    console.error('[Microservicio Expedientes] No se pudo inicializar PostgreSQL:', err);
    process.exit(1);
  });
