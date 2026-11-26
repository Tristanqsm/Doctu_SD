const db = require('../database/db');
const { procesarEventoPorId } = require('../workers/outboxWorker');

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

function getOutboxEventos(req, res) {
  try {
    const eventos = db.prepare(`
      SELECT id, evento, payload, estado, intentos, ultimo_error, creado_en, procesado_en
      FROM outbox
      ORDER BY id DESC
      LIMIT 50
    `).all();

    return res.status(200).json({
      total: eventos.length,
      eventos
    });
  } catch (err) {
    console.error('Error en getOutboxEventos:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

async function postNuevoExpediente(req, res) {
  const { id: medicoId } = req.user;
  const rawKey = req.headers['idempotency-key'];
  const idempotencyKey = typeof rawKey === 'string' && rawKey.trim() !== '' ? rawKey.trim() : null;

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

  // 1. Verificar idempotencia antes de insertar
  if (idempotencyKey) {
    const existente = db.prepare('SELECT * FROM expedientes WHERE idempotency_key = ?').get(idempotencyKey);
    if (existente) {
      console.log(`[Idempotencia] Reintento detectado para key="${idempotencyKey}" -> devolviendo expediente #${existente.id}`);
      return res.status(200).json({
        mensaje: 'Expediente recuperado por idempotencia (no se creó duplicado)',
        idempotente: true,
        expediente: existente
      });
    }
  }

  if (!id_paciente || !motivo_consulta || !diagnostico || !tratamiento_receta) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'id_paciente, motivo_consulta, diagnostico y tratamiento_receta son obligatorios.'
    });
  }

  let expedienteCreado;
  let outboxId = null;

  // 2. Transacción atómica: guardar expediente + registrar evento en tabla outbox
  try {
    const citaIdNum = id_cita ? Number(id_cita) : null;
    const fechaFinal = fecha || new Date().toISOString().split('T')[0];

    db.exec('BEGIN');

    const insertExp = db.prepare(`
      INSERT INTO expedientes (
        id_paciente, id_medico, id_cita, idempotency_key, fecha,
        motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial,
        diagnostico, tratamiento_receta, notas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const infoExp = insertExp.run(
      Number(id_paciente),
      medicoId,
      citaIdNum,
      idempotencyKey,
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

    const nuevoExpId = Number(infoExp.lastInsertRowid);

    if (citaIdNum) {
      const insertOutbox = db.prepare(`
        INSERT INTO outbox (evento, payload, auth_header, estado)
        VALUES (?, ?, ?, 'PENDIENTE')
      `);

      const infoOutbox = insertOutbox.run(
        'EXPEDIENTE_CREADO',
        JSON.stringify({
          id_expediente: nuevoExpId,
          id_cita: citaIdNum,
          estado: 'Atendida'
        }),
        req.headers.authorization || ''
      );
      outboxId = Number(infoOutbox.lastInsertRowid);
    }

    db.exec('COMMIT');

    expedienteCreado = db.prepare('SELECT * FROM expedientes WHERE id = ?').get(nuevoExpId);
    console.log(
      `[Microservicio Expedientes] Expediente #${expedienteCreado.id} guardado` +
      (outboxId ? ` (Outbox #${outboxId} encolado para Cita #${citaIdNum}).` : '.')
    );
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}

    // Manejo de condición de carrera si dos peticiones iguales llegaron al mismo milisegundo
    if (idempotencyKey && err.message && err.message.includes('UNIQUE')) {
      const existente = db.prepare('SELECT * FROM expedientes WHERE idempotency_key = ?').get(idempotencyKey);
      if (existente) {
        return res.status(200).json({
          mensaje: 'Expediente recuperado por idempotencia (no se creó duplicado)',
          idempotente: true,
          expediente: existente
        });
      }
    }

    console.error('Error en postNuevoExpediente:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }

  // 3. Intento inmediato (si agenda está caída, el Outbox Worker lo reintentará cada 5s)
  let citaActualizada = null;
  let advertenciaAgenda = null;

  if (outboxId) {
    const resultado = await procesarEventoPorId(outboxId);
    if (resultado.ok) {
      citaActualizada = true;
    } else {
      citaActualizada = false;
      advertenciaAgenda = `${resultado.error}. Evento #${outboxId} guardado en Outbox para reintento automático.`;
    }
  }

  return res.status(201).json({
    mensaje: 'Expediente registrado exitosamente',
    expediente: expedienteCreado,
    cita_actualizada: citaActualizada,
    outbox_id: outboxId,
    ...(advertenciaAgenda ? { advertencia_agenda: advertenciaAgenda } : {})
  });
}

module.exports = {
  getExpedientes,
  getHistorialPaciente,
  getVerExpediente,
  getOutboxEventos,
  postNuevoExpediente
};