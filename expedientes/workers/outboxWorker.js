const os = require('os');
const { pool } = require('../database/db');

const AGENDA_SERVICE_URL = process.env.AGENDA_SERVICE_URL || 'http://servicio-agenda:3002';
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_INTERVAL_MS || 5000);
// Debe ser bastante menor que el timeout del gateway (3s): si agenda no contesta, el
// médico recibe su 201 a tiempo y el evento se queda en el outbox para reintento.
const AGENDA_TIMEOUT_MS = Number(process.env.AGENDA_TIMEOUT_MS || 1500);
const LOTE_MAXIMO = 20;
const REPLICA = os.hostname();

let procesando = false;
let intervalo = null;

/*
 * Entrega de un evento con varias réplicas
 * ----------------------------------------
 * Cada réplica de expedientes corre su propio worker sobre la MISMA tabla outbox.
 * Para que dos réplicas no envíen el mismo evento a la vez, cada evento se toma con
 *
 *     SELECT ... FOR UPDATE SKIP LOCKED
 *
 * dentro de una transacción: la fila queda bloqueada mientras se llama a agenda, y la
 * otra réplica, en vez de esperar, se la salta y toma la siguiente. El UPDATE con el
 * resultado se hace en la misma transacción, y el COMMIT libera el candado.
 *
 * Si la réplica muere después de que agenda respondió pero antes del COMMIT, el evento
 * sigue PENDIENTE y se vuelve a enviar: la entrega es "al menos una vez". Es seguro
 * porque marcar una cita como 'Atendida' dos veces deja el mismo resultado (idempotente).
 */

async function actualizarEvento(client, id, estado, errorMsg) {
  await client.query(
    `UPDATE outbox
     SET estado = $1, intentos = intentos + 1, ultimo_error = $2
     WHERE id = $3`,
    [estado, errorMsg, id]
  );
}

async function entregarEvento(client, eventoRow) {
  let payload;
  try {
    payload = JSON.parse(eventoRow.payload);
  } catch (err) {
    await actualizarEvento(client, eventoRow.id, 'FALLIDO', `Payload JSON inválido: ${err.message}`);
    return { ok: false, error: 'Payload inválido' };
  }

  let resp;
  try {
    resp = await fetch(`${AGENDA_SERVICE_URL}/citas/${payload.id_cita}/estado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: eventoRow.auth_header || ''
      },
      body: JSON.stringify({ estado: payload.estado || 'Atendida' }),
      signal: AbortSignal.timeout(AGENDA_TIMEOUT_MS)
    });
  } catch (err) {
    const motivo = err.name === 'TimeoutError' ? `sin respuesta en ${AGENDA_TIMEOUT_MS}ms` : err.message;
    const errorMsg = `No se pudo contactar a servicio-agenda (${motivo})`;
    await actualizarEvento(client, eventoRow.id, 'PENDIENTE', errorMsg);
    console.warn(
      `[Outbox Worker ${REPLICA}] Evento #${eventoRow.id} sigue PENDIENTE (intento #${eventoRow.intentos + 1}): ${errorMsg}`
    );
    return { ok: false, error: errorMsg, agendaInalcanzable: true };
  }

  if (resp.ok) {
    await client.query(
      `UPDATE outbox
       SET estado = 'PROCESADO',
           intentos = intentos + 1,
           ultimo_error = NULL,
           procesado_por = $1,
           procesado_en = now()
       WHERE id = $2`,
      [REPLICA, eventoRow.id]
    );
    console.log(
      `[Outbox Worker ${REPLICA}] Evento #${eventoRow.id} PROCESADO: Cita #${payload.id_cita} -> ${payload.estado}`
    );
    return { ok: true };
  }

  const bodyErr = await resp.text().catch(() => '');
  const errorMsg = `Agenda respondió HTTP ${resp.status}: ${bodyErr}`;
  // Errores 4xx (excepto 408/429) no se arreglan reintentando
  const esErrorPermanente = resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429;
  const nuevoEstado = esErrorPermanente ? 'FALLIDO' : 'PENDIENTE';

  await actualizarEvento(client, eventoRow.id, nuevoEstado, errorMsg);
  console.warn(`[Outbox Worker ${REPLICA}] Evento #${eventoRow.id} (${nuevoEstado}): ${errorMsg}`);
  return { ok: false, error: errorMsg, agendaInalcanzable: nuevoEstado === 'PENDIENTE' };
}

/**
 * Toma (con candado) un evento PENDIENTE y lo entrega. Si se pasa `id`, solo ese evento.
 * Regresa { tomado: false } si no había evento libre (no hay o lo tiene otra réplica).
 */
async function tomarYEntregar(id = null) {
  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT *
       FROM outbox
       WHERE estado = 'PENDIENTE' ${id ? 'AND id = $1' : ''}
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      id ? [id] : []
    );

    if (!rows[0]) {
      await client.query('COMMIT');
      return { tomado: false };
    }

    const resultado = await entregarEvento(client, rows[0]);
    await client.query('COMMIT');
    return { tomado: true, ...resultado };
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(`[Outbox Worker ${REPLICA}] Error procesando outbox:`, err.message);
    return { tomado: false, ok: false, error: `Error interno del outbox (${err.message})` };
  } finally {
    if (client) client.release();
  }
}

// Intento inmediato al crear el expediente (lo llama el controlador)
async function procesarEventoPorId(outboxId) {
  const resultado = await tomarYEntregar(outboxId);
  if (resultado.tomado || resultado.error) return resultado;

  // No se pudo tomar: o ya se procesó, o el worker de otra réplica lo tiene en este momento
  try {
    const { rows } = await pool.query('SELECT estado, ultimo_error FROM outbox WHERE id = $1', [outboxId]);
    const evento = rows[0];
    if (!evento || evento.estado === 'PROCESADO') return { ok: true };
    if (evento.estado === 'FALLIDO') return { ok: false, error: evento.ultimo_error || 'Evento fallido' };
    return { ok: false, error: 'Otra réplica está entregando el evento' };
  } catch (err) {
    return { ok: false, error: `Error interno del outbox (${err.message})` };
  }
}

async function procesarPendientes() {
  if (procesando) return;
  procesando = true;

  try {
    for (let i = 0; i < LOTE_MAXIMO; i++) {
      const resultado = await tomarYEntregar();
      if (!resultado.tomado) break;
      // Si agenda no responde o devuelve 5xx, no tiene caso intentar el resto en esta vuelta
      if (resultado.agendaInalcanzable) break;
    }
  } finally {
    procesando = false;
  }
}

function iniciarOutboxWorker() {
  console.log(
    `[Outbox Worker ${REPLICA}] Iniciado (revisión cada ${POLL_INTERVAL_MS / 1000}s hacia ${AGENDA_SERVICE_URL}, FOR UPDATE SKIP LOCKED)`
  );
  intervalo = setInterval(procesarPendientes, POLL_INTERVAL_MS);
}

function detenerOutboxWorker() {
  if (intervalo) clearInterval(intervalo);
  intervalo = null;
}

module.exports = {
  iniciarOutboxWorker,
  detenerOutboxWorker,
  procesarEventoPorId,
  procesarPendientes
};