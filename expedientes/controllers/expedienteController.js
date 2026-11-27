const { pool } = require('../database/db');
const { procesarEventoPorId } = require('../workers/outboxWorker');

function numeroOpcional(valor) {
  return valor !== undefined && valor !== '' && valor !== null ? parseFloat(valor) : null;
}

async function getExpedientes(req, res) {
  const { id: userId, rol: userRol } = req.user;

  try {
    const columna = userRol === 'medico' ? 'id_medico' : 'id_paciente';
    const { rows: expedientes } = await pool.query(
      `SELECT *
       FROM expedientes
       WHERE ${columna} = $1
       ORDER BY fecha DESC, id DESC`,
      [userId]
    );

    return res.status(200).json({
      total: expedientes.length,
      expedientes
    });
  } catch (err) {
    console.error('Error en getExpedientes:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

async function getHistorialPaciente(req, res) {
  const pacienteId = Number(req.params.id);
  if (!Number.isInteger(pacienteId) || pacienteId <= 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'ID de paciente inválido.' });
  }

  try {
    const { rows: expedientes } = await pool.query(
      `SELECT *
       FROM expedientes
       WHERE id_paciente = $1
       ORDER BY fecha DESC, id DESC`,
      [pacienteId]
    );

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

async function getVerExpediente(req, res) {
  const expedienteId = Number(req.params.id);
  const { id: userId, rol: userRol } = req.user;

  if (!Number.isInteger(expedienteId) || expedienteId <= 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'ID de expediente inválido.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM expedientes WHERE id = $1', [expedienteId]);
    const expediente = rows[0];

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

async function getOutboxEventos(req, res) {
  try {
    const { rows: eventos } = await pool.query(`
      SELECT id, evento, payload, estado, intentos, ultimo_error, procesado_por, creado_en, procesado_en
      FROM outbox
      ORDER BY id DESC
      LIMIT 50
    `);

    return res.status(200).json({
      total: eventos.length,
      eventos
    });
  } catch (err) {
    console.error('Error en getOutboxEventos:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

async function buscarPorIdempotencyKey(idempotencyKey) {
  const { rows } = await pool.query('SELECT * FROM expedientes WHERE idempotency_key = $1', [idempotencyKey]);
  return rows[0] || null;
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

  if (!id_paciente || !motivo_consulta || !diagnostico || !tratamiento_receta) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'id_paciente, motivo_consulta, diagnostico y tratamiento_receta son obligatorios.'
    });
  }

  let expedienteCreado;
  let outboxId = null;
  const citaIdNum = id_cita ? Number(id_cita) : null;
  const fechaFinal = fecha || new Date().toISOString().split('T')[0];

  /*
   * 1. Transacción atómica: expediente + evento en la tabla outbox.
   *
   * Idempotencia con un solo INSERT ... ON CONFLICT (idempotency_key) DO NOTHING:
   *  - No se hace "consultar y luego insertar": entre ambas consultas otra réplica
   *    podría insertar la misma llave.
   *  - No se atrapa el error UNIQUE: en PostgreSQL ese error deja la transacción
   *    abortada (y con ella el INSERT del outbox).
   * Si la llave ya existía, el INSERT no regresa filas: se deshace la transacción
   * (no se encola otro evento) y se responde con el expediente original.
   */
  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO expedientes (
        id_paciente, id_medico, id_cita, idempotency_key, fecha,
        motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial,
        diagnostico, tratamiento_receta, notas
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *`,
      [
        Number(id_paciente),
        medicoId,
        citaIdNum,
        idempotencyKey,
        fechaFinal,
        motivo_consulta.trim(),
        numeroOpcional(peso_kg),
        numeroOpcional(talla_cm),
        numeroOpcional(temperatura_c),
        presion_arterial ? presion_arterial.trim() : null,
        diagnostico.trim(),
        tratamiento_receta.trim(),
        notas ? notas.trim() : null
      ]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      const existente = await buscarPorIdempotencyKey(idempotencyKey);
      if (!existente) {
        return res.status(409).json({ error: 'Conflict', mensaje: 'Idempotency-Key en uso; reintenta.' });
      }
      console.log(`[Idempotencia] Reintento detectado para key="${idempotencyKey}" -> devolviendo expediente #${existente.id}`);
      return res.status(200).json({
        mensaje: 'Expediente recuperado por idempotencia (no se creó duplicado)',
        idempotente: true,
        expediente: existente
      });
    }
    expedienteCreado = rows[0];

    if (citaIdNum) {
      const infoOutbox = await client.query(
        `INSERT INTO outbox (evento, payload, auth_header, estado)
         VALUES ($1, $2, $3, 'PENDIENTE')
         RETURNING id`,
        [
          'EXPEDIENTE_CREADO',
          JSON.stringify({
            id_expediente: expedienteCreado.id,
            id_cita: citaIdNum,
            estado: 'Atendida'
          }),
          req.headers.authorization || ''
        ]
      );
      outboxId = infoOutbox.rows[0].id;
    }

    await client.query('COMMIT');

    console.log(
      `[Microservicio Expedientes] Expediente #${expedienteCreado.id} guardado` +
      (outboxId ? ` (Outbox #${outboxId} encolado para Cita #${citaIdNum}).` : '.')
    );
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});

    // Clase 22 = datos inválidos (ej. fecha mal formada): error del cliente, no del servidor
    if (err.code && err.code.startsWith('22')) {
      return res.status(400).json({ error: 'Bad Request', mensaje: err.message });
    }

    console.error('Error en postNuevoExpediente:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  } finally {
    if (client) client.release();
  }

  // 2. Intento inmediato (si agenda está caída, el Outbox Worker lo reintentará cada 5s)
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
