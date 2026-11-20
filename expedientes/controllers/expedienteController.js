const db = require('../database/db');

const AGENDA_SERVICE_URL = process.env.AGENDA_SERVICE_URL || 'http://servicio-agenda:3002';

function getExpedientes(req, res) {
  const { id: userId, rol: userRol } = req.user;

  try {
    const columna = userRol === 'medico' ? 'id_medico' : 'id_paciente';
    const expedientes = db.prepare(`
      SELECT *
      FROM expedientes
      WHERE ${columna} = ?
      ORDER BY fecha DESC, id DESC
    `).all(userId);

    return res.status(200).json({
      total: expedientes.length,
      expedientes
    });
  } catch (err) {
    console.error('Error en getExpedientes:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function getHistorialPaciente(req, res) {
  const pacienteId = Number(req.params.id);
  if (!Number.isInteger(pacienteId) || pacienteId <= 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'ID de paciente inválido.' });
  }

  try {
    const expedientes = db.prepare(`
      SELECT *
      FROM expedientes
      WHERE id_paciente = ?
      ORDER BY fecha DESC, id DESC
    `).all(pacienteId);

    return res.status(200).json({
      id_paciente: pacienteId,
      total: expedientes.length,
      expedientes
    });
  } catch (err) {
    console.error('Error en getHistorialPaciente:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function getVerExpediente(req, res) {
  const expedienteId = Number(req.params.id);
  const { id: userId, rol: userRol } = req.user;

  if (!Number.isInteger(expedienteId) || expedienteId <= 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'ID de expediente inválido.' });
  }

  try {
    const expediente = db.prepare('SELECT * FROM expedientes WHERE id = ?').get(expedienteId);

    if (!expediente) {
      return res.status(404).json({
        error: 'Not Found',
        mensaje: 'No se encontró el expediente solicitado.'
      });
    }

    if (userRol === 'paciente' && expediente.id_paciente !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        mensaje: 'No tienes permiso para consultar este expediente.'
      });
    }

    return res.status(200).json({ expediente });
  } catch (err) {
    console.error('Error en getVerExpediente:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

async function postNuevoExpediente(req, res) {
  const { id: medicoId } = req.user;
  const {
    id_paciente,
    id_cita,
    fecha,
    motivo_consulta,
    peso_kg,
    talla_cm,
    temperatura_c,
    presion_arterial,
    diagnostico,
    tratamiento_receta,
    notas
  } = req.body;

  if (!id_paciente || !motivo_consulta || !diagnostico || !tratamiento_receta) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'id_paciente, motivo_consulta, diagnostico y tratamiento_receta son obligatorios.'
    });
  }

  let expedienteCreado;
  try {
    const citaIdNum = id_cita ? Number(id_cita) : null;
    const fechaFinal = fecha || new Date().toISOString().split('T')[0];

    const insert = db.prepare(`
      INSERT INTO expedientes (
        id_paciente, id_medico, id_cita, fecha,
        motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial,
        diagnostico, tratamiento_receta, notas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insert.run(
      Number(id_paciente),
      medicoId,
      citaIdNum,
      fechaFinal,
      motivo_consulta.trim(),
      peso_kg !== undefined && peso_kg !== '' && peso_kg !== null ? parseFloat(peso_kg) : null,
      talla_cm !== undefined && talla_cm !== '' && talla_cm !== null ? parseFloat(talla_cm) : null,
      temperatura_c !== undefined && temperatura_c !== '' && temperatura_c !== null ? parseFloat(temperatura_c) : null,
      presion_arterial ? presion_arterial.trim() : null,
      diagnostico.trim(),
      tratamiento_receta.trim(),
      notas ? notas.trim() : null
    );

    expedienteCreado = db.prepare('SELECT * FROM expedientes WHERE id = ?').get(info.lastInsertRowid);
    console.log(`[Microservicio Expedientes] Expediente #${expedienteCreado.id} guardado.`);
  } catch (err) {
    console.error('Error en postNuevoExpediente:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }

  let citaActualizada = null;
  let advertenciaAgenda = null;

  if (expedienteCreado.id_cita) {
    try {
      const resp = await fetch(`${AGENDA_SERVICE_URL}/citas/${expedienteCreado.id_cita}/estado`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || ''
        },
        body: JSON.stringify({ estado: 'Atendida' }),
        signal: AbortSignal.timeout(3000)
      });

      if (resp.ok) {
        citaActualizada = true;
      } else {
        citaActualizada = false;
        const bodyErr = await resp.text();
        advertenciaAgenda = `Agenda respondió HTTP ${resp.status}: ${bodyErr}`;
      }
    } catch (err) {
      citaActualizada = false;
      advertenciaAgenda = `No se pudo contactar a servicio-agenda (${err.message}). El expediente sí fue guardado.`;
      console.warn('[Microservicio Expedientes]', advertenciaAgenda);
    }
  }

  return res.status(201).json({
    mensaje: 'Expediente registrado exitosamente',
    expediente: expedienteCreado,
    cita_actualizada: citaActualizada,
    ...(advertenciaAgenda ? { advertencia_agenda: advertenciaAgenda } : {})
  });
}

module.exports = {
  getExpedientes,
  getHistorialPaciente,
  getVerExpediente,
  postNuevoExpediente
};