const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'doctu.db');
const db = new DatabaseSync(dbPath);

// Activar llaves foráneas
db.exec('PRAGMA foreign_keys = ON;');

// Crear tablas si no existen
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('medico', 'paciente')),
      nombre_completo TEXT NOT NULL,
      telefono TEXT,
      curp TEXT,
      especialidad TEXT,
      cedula TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_paciente INTEGER NOT NULL REFERENCES usuarios(id),
      id_medico INTEGER NOT NULL REFERENCES usuarios(id),
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      motivo TEXT NOT NULL,
      estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Confirmada', 'Atendida', 'Cancelada')),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expedientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_paciente INTEGER NOT NULL REFERENCES usuarios(id),
      id_medico INTEGER NOT NULL REFERENCES usuarios(id),
      id_cita INTEGER REFERENCES citas(id),
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

  // Verificar si hay usuarios, si no hay sembrar datos iniciales
  const count = db.prepare('SELECT COUNT(*) as total FROM usuarios').get().total;
  if (count === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  console.log('Sembrando datos iniciales en la base de datos local...');

  // 1. Usuarios Médicos
  const insertUser = db.prepare(`
    INSERT INTO usuarios (email, password, rol, nombre_completo, telefono, curp, especialidad, cedula)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('doctor@doctu.com', 'password123', 'medico', 'Dr. Roberto Muelas', '5511223344', null, 'Medicina General', 'MED-123456');
  insertUser.run('elena@doctu.com', 'password123', 'medico', 'Dra. Elena Ruiz', '5522334455', null, 'Medicina Familiar', 'MED-987654');

  // 2. Usuarios Pacientes
  insertUser.run('paciente@doctu.com', 'password123', 'paciente', 'Juan Pérez López', '5512345678', 'PELJ900101HDFRRN01', null, null);
  insertUser.run('maria@doctu.com', 'password123', 'paciente', 'María García Soto', '5587654321', 'GASM920314MDFRRN05', null, null);
  insertUser.run('carlos@doctu.com', 'password123', 'paciente', 'Carlos Ramírez Gómez', '5543219876', 'RAGC881105HDFRRN02', null, null);

  // 3. Citas Iniciales
  const hoy = new Date().toISOString().split('T')[0];
  const mañana = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const insertCita = db.prepare(`
    INSERT INTO citas (id_paciente, id_medico, fecha, hora, motivo, estado)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertCita.run(3, 1, hoy, '10:00', 'Revisión por dolor abdominal y seguimiento', 'Confirmada');
  insertCita.run(4, 1, hoy, '11:30', 'Chequeo de rutina y presión arterial', 'Pendiente');
  insertCita.run(5, 1, mañana, '09:00', 'Dolor de cabeza frecuente y fatiga', 'Pendiente');
  insertCita.run(3, 2, mañana, '16:00', 'Consulta general preventiva', 'Confirmada');

  // 4. Expedientes Clínicos Previos
  const insertExpediente = db.prepare(`
    INSERT INTO expedientes (id_paciente, id_medico, id_cita, fecha, motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial, diagnostico, tratamiento_receta, notas)
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

  console.log('Datos iniciales sembrados con éxito.');
}

initDatabase();

module.exports = db;

