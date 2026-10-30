const db = require('../database/db');

function getPortal(req, res) {
  const pacienteId = req.session.user.id;

  try {
    // 1. Citas del paciente con datos del médico
    const citas = db.prepare(`
      SELECT c.id, c.fecha, c.hora, c.motivo, c.estado,
             m.nombre_completo as medico_nombre, m.especialidad as medico_especialidad
      FROM citas c
      JOIN usuarios m ON c.id_medico = m.id
      WHERE c.id_paciente = ?
      ORDER BY c.fecha ASC, c.hora ASC
    `).all(pacienteId);

    // 2. Historial clínico / Expedientes del paciente
    const expedientes = db.prepare(`
      SELECT e.id, e.fecha, e.motivo_consulta, e.diagnostico, e.tratamiento_receta,
             e.peso_kg, e.talla_cm, e.temperatura_c, e.presion_arterial, e.notas,
             m.nombre_completo as medico_nombre, m.especialidad as medico_especialidad
      FROM expedientes e
      JOIN usuarios m ON e.id_medico = m.id
      WHERE e.id_paciente = ?
      ORDER BY e.fecha DESC, e.id DESC
    `).all(pacienteId);

    // 3. Lista de médicos disponibles para agendar
    const medicos = db.prepare(`
      SELECT id, nombre_completo, especialidad
      FROM usuarios
      WHERE rol = 'medico'
      ORDER BY nombre_completo ASC
    `).all();

    res.render('portal-paciente', {
      title: 'Portal del Paciente - Doctu',
      user: req.session.user,
      citas,
      expedientes,
      medicos,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error en getPortal:', err);
    res.status(500).render('error', {
      title: 'Error',
      mensaje: 'Error al cargar el portal del paciente: ' + err.message,
      user: req.session.user
    });
  }
}

module.exports = {
  getPortal
};

