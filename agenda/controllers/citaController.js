const db = require('../database/db');

function getCitas(req, res) {
  const { id: userId, rol: userRol } = req.user;
  const hoy = new Date().toISOString().split('T')[0];

  try {
    const columna = userRol === 'medico' ? 'id_medico' : 'id_paciente';
    const citas = db.prepare(`
      SELECT id, id_paciente, id_medico, fecha, hora, motivo, estado, creado_en
      FROM citas
      WHERE ${columna} = ?
      ORDER BY fecha ASC, hora ASC
    `).all(userId);

    const citasHoy = citas.filter(c => c.fecha === hoy);
    const citasPendientes = citas.filter(c => c.estado === 'Pendiente' || c.estado === 'Confirmada').length;

    return res.status(200).json({
      hoy,
      resumen: {
        total: citas.length,
        totalCitasHoy: citasHoy.length,
        citasPendientes
      },
      citas
    });
  } catch (err) {
    console.error('Error en getCitas:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: 'Error al consultar citas: ' + err.message
    });
  }
}

function getCitaPorId(req, res) {
  const citaId = Number(req.params.id);
  const { id: userId, rol: userRol } = req.user;

  if (!Number.isInteger(citaId) || citaId <= 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'ID de cita inválido.' });
  }

  try {
    const cita = db.prepare(`
      SELECT id, id_paciente, id_medico, fecha, hora, motivo, estado, idempotency_key, creado_en
      FROM citas
      WHERE id = ?
    `).get(citaId);

    if (!cita) {
      return res.status(404).json({ error: 'Not Found', mensaje: 'Cita no encontrada.' });
    }

    const esSuPaciente = userRol === 'paciente' && cita.id_paciente === userId;
    const esSuMedico = userRol === 'medico' && cita.id_medico === userId;
    if (!esSuPaciente && !esSuMedico) {
      return res.status(403).json({
        error: 'Forbidden',
        mensaje: 'No tienes permiso para ver esta cita.'
      });
    }

    return res.status(200).json({ cita });
  } catch (err) {
    console.error('Error en getCitaPorId:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function postNuevaCita(req, res) {
  const { id: userId, rol: userRol } = req.user;
  const rawKey = req.headers['idempotency-key'];
  const idempotencyKey = typeof rawKey === 'string' && rawKey.trim() !== '' ? rawKey.trim() : null;
  let { id_paciente, id_medico, fecha, hora, motivo } = req.body;

  // 1. Verificar si la llave de idempotencia ya fue procesada
  if (idempotencyKey) {
    const existente = db.prepare(`
      SELECT id, id_paciente, id_medico, fecha, hora, motivo, estado, idempotency_key, creado_en
      FROM citas
      WHERE idempotency_key = ?
    `).get(idempotencyKey);

    if (existente) {
      console.log(`[Idempotencia Agenda] Reintento detectado para key="${idempotencyKey}" -> devolviendo cita #${existente.id}`);
      return res.status(200).json({
        mensaje: 'Cita recuperada por idempotencia (no se creó duplicado)',
        idempotente: true,
        cita: existente
      });
    }
  }

  if (userRol === 'paciente') {
    id_paciente = userId;
  }
  if (userRol === 'medico' && !id_medico) {
    id_medico = userId;
  }

  if (!id_paciente || !id_medico || !fecha || !hora || !motivo) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Todos los campos son obligatorios (id_paciente, id_medico, fecha, hora, motivo).'
    });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO citas (id_paciente, id_medico, idempotency_key, fecha, hora, motivo, estado)
      VALUES (?, ?, ?, ?, ?, ?, 'Confirmada')
    `);

    const info = insert.run(
      Number(id_paciente),
      Number(id_medico),
      idempotencyKey,
      fecha,
      hora,
      motivo.trim()
    );

    const nuevaCitaId = Number(info.lastInsertRowid);
    console.log(`[Microservicio Agenda] Nueva cita #${nuevaCitaId} registrada para el ${fecha} a las ${hora}`);

    return res.status(201).json({
      mensaje: 'Cita agendada correctamente',
      cita: {
        id: nuevaCitaId,
        id_paciente: Number(id_paciente),
        id_medico: Number(id_medico),
        idempotency_key: idempotencyKey,
        fecha,
        hora,
        motivo: motivo.trim(),
        estado: 'Confirmada'
      }
    });
  } catch (err) {
    // Manejo de condición de carrera si dos peticiones iguales llegan simultáneamente
    if (idempotencyKey && err.message && err.message.includes('UNIQUE')) {
      const existente = db.prepare(`
        SELECT id, id_paciente, id_medico, fecha, hora, motivo, estado, idempotency_key, creado_en
        FROM citas
        WHERE idempotency_key = ?
      `).get(idempotencyKey);

      if (existente) {
        return res.status(200).json({
          mensaje: 'Cita recuperada por idempotencia (no se creó duplicado)',
          idempotente: true,
          cita: existente
        });
      }
    }

    console.error('Error en postNuevaCita:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: err.message
    });
  }
}

function updateEstadoCita(req, res) {
  const citaId = req.params.id;
  const { estado } = req.body;
  const { id: userId, rol: userRol } = req.user;

  const estadosValidos = ['Pendiente', 'Confirmada', 'Atendida', 'Cancelada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Estado inválido'
    });
  }

  try {
    const cita = db.prepare('SELECT id, id_paciente, id_medico FROM citas WHERE id = ?').get(citaId);
    if (!cita) {
      return res.status(404).json({ error: 'Not Found', mensaje: 'Cita no encontrada' });
    }

    const esSuPaciente = userRol === 'paciente' && cita.id_paciente === userId;
    const esSuMedico = userRol === 'medico' && cita.id_medico === userId;
    if (!esSuPaciente && !esSuMedico) {
      return res.status(403).json({
        error: 'Forbidden',
        mensaje: 'No tienes permiso para modificar esta cita.'
      });
    }

    if (userRol === 'paciente' && estado !== 'Cancelada') {
      return res.status(403).json({
        error: 'Forbidden',
        mensaje: 'Un paciente solo puede cancelar sus citas.'
      });
    }

    db.prepare('UPDATE citas SET estado = ? WHERE id = ?').run(estado, citaId);

    console.log(`[Microservicio Agenda] Cita #${citaId} actualizada a estado: ${estado}`);

    return res.status(200).json({
      mensaje: 'Estado de cita actualizado',
      cita_id: Number(citaId),
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
  getCitas,
  getCitaPorId,
  postNuevaCita,
  updateEstadoCita
};