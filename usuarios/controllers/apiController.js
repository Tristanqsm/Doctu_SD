const db = require('../database/db');

function getHealth(req, res) {
  res.json({
    status: 'ok',
    system: 'Doctu Monolito',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}

function getPacientes(req, res) {
  try {
    const pacientes = db.prepare(`
      SELECT id, nombre_completo, email, telefono, curp, creado_en
      FROM usuarios
      WHERE rol = 'paciente'
      ORDER BY nombre_completo ASC
    `).all();
    res.json(pacientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getCitas(req, res) {
  try {
    const citas = db.prepare(`
      SELECT c.*,
             p.nombre_completo as paciente_nombre,
             m.nombre_completo as medico_nombre, m.especialidad as medico_especialidad
      FROM citas c
      JOIN usuarios p ON c.id_paciente = p.id
      JOIN usuarios m ON c.id_medico = m.id
      ORDER BY c.fecha ASC, c.hora ASC
    `).all();
    res.json(citas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getExpedientes(req, res) {
  try {
    const expedientes = db.prepare(`
      SELECT e.*,
             p.nombre_completo as paciente_nombre,
             m.nombre_completo as medico_nombre
      FROM expedientes e
      JOIN usuarios p ON e.id_paciente = p.id
      JOIN usuarios m ON e.id_medico = m.id
      ORDER BY e.fecha DESC
    `).all();
    res.json(expedientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getHealth,
  getPacientes,
  getCitas,
  getExpedientes
};

