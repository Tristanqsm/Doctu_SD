const { pool } = require('../database/db');

const AGENDA_SERVICE_URL = process.env.AGENDA_SERVICE_URL || 'http://servicio-agenda:3002';
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_INTERVAL_MS || 5000);

let procesando = false;
let intervalo = null;

async function marcarEvento(id, estado, errorMsg) {
  await pool.query(
    `UPDATE outbox
     SET estado = $1, intentos = intentos + 1, ultimo_error = $2
     WHERE id = $3`,
    [estado, errorMsg, id]
  );
}

async function entregarEvento(eventoRow) {
  let payload;
  try {
    payload = JSON.parse(eventoRow.payload);
  } catch (err) {
    await marcarEvento(eventoRow.id, 'FALLIDO', `Payload JSON inválido: ${err.message}`);
    return { ok: false, error: 'Payload inválido' };
  }

  try {
    const resp = await fetch(`${AGENDA_SERVICE_URL}/citas/${payload.id_cita}/estado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: eventoRow.auth_header || ''
      },
      body: JSON.stringify({ estado: payload.estado || 'Atendida' }),
      signal: AbortSignal.timeout(3000)
    });

    if (resp.ok) {
      await pool.query(
        `UPDATE outbox
         SET estado = 'PROCESADO',
             intentos = intentos + 1,
             ultimo_error = NULL,
             procesado_en = now()
         WHERE id = $1`,
        [eventoRow.id]
      );

      console.log(
        `[Outbox Worker] Evento #${eventoRow.id} PROCESADO: Cita #${payload.id_cita} -> ${payload.estado}`
      );
      return { ok: true };
    }

    const bodyErr = await resp.text();
    const errorMsg = `Agenda respondió HTTP ${resp.status}: ${bodyErr}`;
    // Errores 4xx (excepto 408/429) no se arreglan reintentando
    const esErrorPermanente = resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429;
    const nuevoEstado = esErrorPermanente ? 'FALLIDO' : 'PENDIENTE';

    await marcarEvento(eventoRow.id, nuevoEstado, errorMsg);

    console.warn(`[Outbox Worker] Evento #${eventoRow.id} (${nuevoEstado}): ${errorMsg}`);
    return { ok: false, error: errorMsg };
  } catch (err) {
    const errorMsg = `No se pudo contactar a servicio-agenda (${err.message})`;
    await marcarEvento(eventoRow.id, 'PENDIENTE', errorMsg);

    console.warn(
      `[Outbox Worker] Evento #${eventoRow.id} sigue PENDIENTE (intento #${eventoRow.intentos + 1}): ${errorMsg}`
    );
    return { ok: false, error: errorMsg };
  }
}

async function procesarEventoPorId(outboxId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM outbox WHERE id = $1 AND estado = 'PENDIENTE'",
      [outboxId]
    );
    if (!rows[0]) return { ok: true };
    return await entregarEvento(rows[0]);
  } catch (err) {
    console.error(`[Outbox Worker] Error procesando evento #${outboxId}:`, err.message);
    return { ok: false, error: `Error interno del outbox (${err.message})` };
  }
}

async function procesarPendientes() {
  if (procesando) return;
  procesando = true;

  try {
    const { rows: pendientes } = await pool.query(`
      SELECT *
      FROM outbox
      WHERE estado = 'PENDIENTE'
      ORDER BY id ASC
      LIMIT 20
    `);

    for (const eventoRow of pendientes) {
      await entregarEvento(eventoRow);
    }
  } catch (err) {
    console.error('[Outbox Worker] Error leyendo tabla outbox:', err.message);
  } finally {
    procesando = false;
  }
}

function iniciarOutboxWorker() {
  console.log(`[Outbox Worker] Iniciado (revisión cada ${POLL_INTERVAL_MS / 1000}s hacia ${AGENDA_SERVICE_URL})`);
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
