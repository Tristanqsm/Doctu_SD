const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'usuarios.db');
const db = new DatabaseSync(dbPath);

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
  `);

  const count = db.prepare('SELECT COUNT(*) as total FROM usuarios').get().total;
  if (count === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  console.log('[Usuarios DB] Sembrando usuarios iniciales...');

  const insertUser = db.prepare(`
    INSERT INTO usuarios (email, password, rol, nombre_completo, telefono, curp, especialidad, cedula)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('doctor@doctu.com', 'password123', 'medico', 'Dr. Roberto Muelas', '5511223344', null, 'Medicina General', 'MED-123456');
  insertUser.run('elena@doctu.com', 'password123', 'medico', 'Dra. Elena Ruiz', '5522334455', null, 'Medicina Familiar', 'MED-987654');

  insertUser.run('paciente@doctu.com', 'password123', 'paciente', 'Juan Pérez López', '5512345678', 'PELJ900101HDFRRN01', null, null);
  insertUser.run('maria@doctu.com', 'password123', 'paciente', 'María García Soto', '5587654321', 'GASM920314MDFRRN05', null, null);
  insertUser.run('carlos@doctu.com', 'password123', 'paciente', 'Carlos Ramírez Gómez', '5543219876', 'RAGC881105HDFRRN02', null, null);

  console.log('[Usuarios DB] Usuarios sembrados con éxito.');
}

initDatabase();

module.exports = db;