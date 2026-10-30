const db = require('../database/db');

function getDashboard(req, res) {
  const doctorId = req.session.user.id;
  const hoy = new Date().toISOString().split('T')[0];
  const busqueda = (req.query.q || '').trim();

  try {
    // 1. Citas del médico (de hoy en adelante o todas ordenadas)
    const citas = db.prepare(`
      SELECT c.id, c.fecha, c.hora, c.motivo, c.estado,
             p.id as paciente_id, p.nombre_completo as paciente_nombre, p.telefono as paciente_telefono, p.curp as paciente_curp
      FROM citas c
      JOIN usuarios p ON c.id_paciente = p.id
      WHERE c.id_medico = ?
      ORDER BY c.fecha ASC, c.hora ASC
    `).all(doctorId);

    // 2. Citas de hoy específicamente
    const citasHoy = citas.filter(c => c.fecha === hoy);

    // 3. Métricas rápidas
    const totalCitasHoy = citasHoy.length;
    const citasPendientes = citas.filter(c => c.estado === 'Pendiente' || c.estado === 'Confirmada').length;
    const totalExpedientes = db.prepare('SELECT COUNT(*) as total FROM expedientes WHERE id_medico = ?').get(doctorId).total;

    // 4. Búsqueda de pacientes (si el médico usa el buscador)
    let pacientesEncontrados = [];
    if (busqueda) {
      pacientesEncontrados = db.prepare(`
        SELECT id, nombre_completo, email, telefono, curp, creado_en
        FROM usuarios
        WHERE rol = 'paciente' AND (nombre_completo LIKE ? OR curp LIKE ? OR email LIKE ?)
        ORDER BY nombre_completo ASC
      `).all(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
    } else {
      // Mostrar los últimos 5 pacientes registrados
      pacientesEncontrados = db.prepare(`
        SELECT id, nombre_completo, email, telefono, curp, creado_en
        FROM usuarios
        WHERE rol = 'paciente'
        ORDER BY id DESC
        LIMIT 5
      `).all();
    }

    res.render('dashboard-medico', {
      title: 'Panel Médico - Doctu',
      user: req.session.user,
      citas,
      citasHoy,
      totalCitasHoy,
      citasPendientes,
      totalExpedientes,
      pacientes: pacientesEncontrados,
      busqueda,
      hoy,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error en getDashboard:', err);
    res.status(500).render('error', {
      title: 'Error',
      mensaje: 'Error al cargar el panel médico: ' + err.message,
      user: req.session.user
    });
  }
}

module.exports = {
  getDashboard
};

