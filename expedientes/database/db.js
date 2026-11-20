const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'expedientes.db');
const db = new DatabaseSync(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expedientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_paciente INTEGER NOT NULL,
      id_medico INTEGER NOT NULL,
      id_cita INTEGER,
      fecha TEXT NOT NULL,
      motivo_consulta TEXT NOT NULL,
      peso_kg REAL,
      talla_cm REAL,
      temperatura_c REAL,
      presion_arterial TEXT,
      diagnostico TEXT NOT NULL,
      tratamiento_receta TEXT NOT NULL,
      notas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as total FROM expedientes').get().total;
  if (count === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  console.log('[Expedientes DB] Sembrando expedientes clínicos iniciales...');

  const insertExpediente = db.prepare(`
    INSERT INTO expedientes (
      id_paciente, id_medico, id_cita, fecha,
      motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial,
      diagnostico, tratamiento_receta, notas
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExpediente.run(
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
  );

  insertExpediente.run(
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
  );

  console.log('[Expedientes DB] Expedientes sembrados con éxito.');
}

initDatabase();

module.exports = db;