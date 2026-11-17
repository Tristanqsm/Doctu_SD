const db = require('../database/db');

// Devolver listas de médicos y pacientes en formato JSON
function getReferencias(req, res) {
  try {
    const medicos = db.prepare(`
      SELECT id, nombre_completo, especialidad
      FROM usuarios
      WHERE rol = 'medico'
      ORDER BY nombre_completo ASC
    `).all();

    const pacientes = db.prepare(`
      SELECT id, nombre_completo, curp
      FROM usuarios
      WHERE rol = 'paciente'
      ORDER BY nombre_completo ASC
    `).all();

    return res.status(200).json({
      mensaje: 'Referencias cargadas correctamente',
      datos: {
        medicos,
        pacientes,
        pacientePreseleccionado: req.query.pacienteId || null
      }
    });
  } catch (err) {
    console.error('Error en getReferencias:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: 'Error al cargar referencias para citas: ' + err.message
    });
  }
}

// Procesar guardado de cita (API REST)
function postNuevaCita(req, res) {
  // Como ya no hay sesiones en memoria, el cliente debe enviar quién está agendando
  let { id_paciente, id_medico, fecha, hora, motivo, rol_solicitante, id_solicitante } = req.body;

  // Lógica de autocompletado
  if (rol_solicitante === 'paciente') {
    id_paciente = id_solicitante;
  }
  if (rol_solicitante === 'medico' && !id_medico) {
    id_medico = id_solicitante;
  }

  if (!id_paciente || !id_medico || !fecha || !hora || !motivo) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Todos los campos son obligatorios'
    });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO citas (id_paciente, id_medico, fecha, hora, motivo, estado)
      VALUES (?, ?, ?, ?, ?, 'Confirmada')
    `);

    const info = insert.run(id_paciente, id_medico, fecha, hora, motivo.trim());

    console.log(`[Microservicio Agenda] Nueva cita #${info.lastInsertRowid} registrada para el ${fecha} a las ${hora}`);

    return res.status(201).json({
      mensaje: 'Cita agendada correctamente',
      cita: {
        id: info.lastInsertRowid,
        id_paciente,
        id_medico,
        fecha,
        hora,
        estado: 'Confirmada'
      }
    });
  } catch (err) {
    console.error('Error en postNuevaCita:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: err.message
    });
  }
}

// Actualizar estado de cita (API REST)
function updateEstadoCita(req, res) {
  const citaId = req.params.id;
  const { estado } = req.body;

  const estadosValidos = ['Pendiente', 'Confirmada', 'Atendida', 'Cancelada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Estado inválido'
    });
  }

  try {
    const result = db.prepare(`
      UPDATE citas
      SET estado = ?
      WHERE id = ?
    `).run(estado, citaId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', mensaje: 'Cita no encontrada' });
    }

    console.log(`[Microservicio Agenda] Cita #${citaId} actualizada a estado: ${estado}`);

    return res.status(200).json({
      mensaje: 'Estado de cita actualizado',
      cita_id: citaId,
      nuevo_estado: estado
    });
  } catch (err) {
    console.error('Error en updateEstadoCita:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: err.message
    });
  }
}

module.exports = {
  getReferencias,
  postNuevaCita,
  updateEstadoCita
};