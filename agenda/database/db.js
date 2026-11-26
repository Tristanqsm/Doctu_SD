const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'agenda.db');
const db = new DatabaseSync(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_paciente INTEGER NOT NULL,
      id_medico INTEGER NOT NULL,
      idempotency_key TEXT,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      motivo TEXT NOT NULL,
      estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Confirmada', 'Atendida', 'Cancelada')),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migración segura si el volumen SQLite ya existía sin idempotency_key
  const columnas = db.prepare('PRAGMA table_info(citas)').all();
  const tieneIdempotency = columnas.some((col) => col.name === 'idempotency_key');
  if (!tieneIdempotency) {
    db.exec('ALTER TABLE citas ADD COLUMN idempotency_key TEXT;');
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citas_idempotency
    ON citas(idempotency_key)
    WHERE idempotency_key IS NOT NULL;
  `);

  const count = db.prepare('SELECT COUNT(*) as total FROM citas').get().total;
  if (count === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  console.log('[Agenda DB] Sembrando citas iniciales...');

  const hoy = new Date().toISOString().split('T')[0];
  const fechaManana = new Date();
  fechaManana.setDate(fechaManana.getDate() + 1);
  const manana = fechaManana.toISOString().split('T')[0];

  const insertCita = db.prepare(`
    INSERT INTO citas (id_paciente, id_medico, fecha, hora, motivo, estado)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertCita.run(3, 1, hoy, '10:00', 'Revisión por dolor abdominal y seguimiento', 'Confirmada');
  insertCita.run(4, 1, hoy, '11:30', 'Chequeo de rutina y presión arterial', 'Pendiente');
  insertCita.run(5, 1, manana, '09:00', 'Dolor de cabeza frecuente y fatiga', 'Pendiente');
  insertCita.run(3, 2, manana, '16:00', 'Consulta general preventiva', 'Confirmada');

  console.log('[Agenda DB] Citas sembradas con éxito.');
}

initDatabase();

module.exports = db;