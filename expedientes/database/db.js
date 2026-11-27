const { Pool, types } = require('pg');

// Las columnas DATE se regresan como texto 'YYYY-MM-DD' (igual que con SQLite) para
// que el frontend no reciba fechas con zona horaria (evita que el 15 se vuelva 14).
types.setTypeParser(1082, (valor) => valor);

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://expedientes:expedientes_pass@postgres-expedientes:5432/expedientes';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10)
});

pool.on('error', (err) => {
  console.error('[Expedientes DB] Error en una conexión inactiva del pool:', err.message);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperarPostgres(maxIntentos = 15) {
  for (let intento = 1; ; intento++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (intento >= maxIntentos) throw err;
      console.warn(`[Expedientes DB] PostgreSQL aún no responde (${err.message}). Reintento ${intento}/${maxIntentos} en 2s...`);
      await sleep(2000);
    }
  }
}

async function initDatabase() {
  await esperarPostgres();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Con varias réplicas arrancando a la vez, todas ejecutan este init. El candado
    // asesor (advisory lock) hace que solo una cree tablas y siembre datos; las demás
    // esperan y, al entrar, ya encuentran todo creado (no se duplican los datos semilla).
    await client.query('SELECT pg_advisory_xact_lock(3003)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS expedientes (
        id SERIAL PRIMARY KEY,
        id_paciente INTEGER NOT NULL,
        id_medico INTEGER NOT NULL,
        id_cita INTEGER,
        idempotency_key TEXT UNIQUE,
        fecha DATE NOT NULL,
        motivo_consulta TEXT NOT NULL,
        peso_kg DOUBLE PRECISION,
        talla_cm DOUBLE PRECISION,
        temperatura_c DOUBLE PRECISION,
        presion_arterial TEXT,
        diagnostico TEXT NOT NULL,
        tratamiento_receta TEXT NOT NULL,
        notas TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_expedientes_paciente ON expedientes(id_paciente);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_expedientes_medico ON expedientes(id_medico);');

    // Tabla Outbox para consistencia eventual hacia servicio-agenda
    await client.query(`
      CREATE TABLE IF NOT EXISTS outbox (
        id SERIAL PRIMARY KEY,
        evento TEXT NOT NULL,
        payload TEXT NOT NULL,
        auth_header TEXT,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE'
          CHECK (estado IN ('PENDIENTE', 'PROCESADO', 'FALLIDO')),
        intentos INTEGER NOT NULL DEFAULT 0,
        ultimo_error TEXT,
        procesado_por TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        procesado_en TIMESTAMPTZ
      );
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_outbox_pendientes ON outbox(id) WHERE estado = 'PENDIENTE';"
    );

    const { rows } = await client.query('SELECT COUNT(*)::int AS total FROM expedientes');
    if (rows[0].total === 0) {
      await seedInitialData(client);
    }

    await client.query('COMMIT');
    console.log('[Expedientes DB] Esquema PostgreSQL listo.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function seedInitialData(client) {
  console.log('[Expedientes DB] Sembrando expedientes clínicos iniciales...');

  const insert = `
    INSERT INTO expedientes (
      id_paciente, id_medico, id_cita, fecha,
      motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial,
      diagnostico, tratamiento_receta, notas
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `;

  await client.query(insert, [
    3,
    1,
    1,
    '2026-05-15',
    'Dolor abdominal en epigastrio de 3 días de evolución acompañado de náuseas.',
    74.5,
    172,
    36.6,
    '120/80',
    'Gastritis aguda / Dispepsia funcional',
    'Omeprazol 20mg cada 24 horas por 14 días. Dieta blanda sin irritantes ni grasas.',
    'Paciente orientado y cooperador. Regresar a revisión en 10 días o en caso de alarma.'
  ]);

  await client.query(insert, [
    4,
    1,
    null,
    '2026-05-10',
    'Malestar general, odinofagia y fiebre leve no cuantificada de 2 días.',
    62.0,
    160,
    37.8,
    '115/75',
    'Faringoamigdalitis aguda',
    'Amoxicilina 500mg cada 8 horas por 7 días. Paracetamol 500mg cada 8 horas si hay dolor o fiebre.',
    'Adecuada hidratación y reposo relativo.'
  ]);

  console.log('[Expedientes DB] Expedientes sembrados con éxito.');
}

module.exports = {
  pool,
  initDatabase
};
