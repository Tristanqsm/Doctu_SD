const db = require('../database/db');

const AGENDA_SERVICE_URL = process.env.AGENDA_SERVICE_URL || 'http://servicio-agenda:3002';
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_INTERVAL_MS || 5000);

let procesando = false;

async function entregarEvento(eventoRow) {
  let payload;
  try {
    payload = JSON.parse(eventoRow.payload);
  } catch (err) {
    db.prepare(`
      UPDATE outbox
      SET estado = 'FALLIDO', intentos = intentos + 1, ultimo_error = ?
      WHERE id = ?
    `).run(`Payload JSON inválido: ${err.message}`, eventoRow.id);
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
      db.prepare(`
        UPDATE outbox
        SET estado = 'PROCESADO',
            intentos = intentos + 1,
            ultimo_error = NULL,
            procesado_en = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(eventoRow.id);

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

    db.prepare(`
      UPDATE outbox
      SET estado = ?, intentos = intentos + 1, ultimo_error = ?
      WHERE id = ?
    `).run(nuevoEstado, errorMsg, eventoRow.id);

    console.warn(`[Outbox Worker] Evento #${eventoRow.id} (${nuevoEstado}): ${errorMsg}`);
    return { ok: false, error: errorMsg };
  } catch (err) {
    const errorMsg = `No se pudo contactar a servicio-agenda (${err.message})`;
    db.prepare(`
      UPDATE outbox
      SET intentos = intentos + 1, ultimo_error = ?
      WHERE id = ?
    `).run(errorMsg, eventoRow.id);

    console.warn(
      `[Outbox Worker] Evento #${eventoRow.id} sigue PENDIENTE (intento #${eventoRow.intentos + 1}): ${errorMsg}`
    );
    return { ok: false, error: errorMsg };
  }
}

async function procesarEventoPorId(outboxId) {
  const row = db.prepare('SELECT * FROM outbox WHERE id = ? AND estado = ?').get(outboxId, 'PENDIENTE');
  if (!row) return { ok: true };
  return entregarEvento(row);
}

async function procesarPendientes() {
  if (procesando) return;
  procesando = true;

  try {
    const pendientes = db.prepare(`
      SELECT *
      FROM outbox
      WHERE estado = 'PENDIENTE'
      ORDER BY id ASC
      LIMIT 20
    `).all();

    for (const eventoRow of pendientes) {
      await entregarEvento(eventoRow);
    }
  } catch (err) {
    console.error('[Outbox Worker] Error leyendo tabla outbox:', err);
  } finally {
    procesando = false;
  }
}

function iniciarOutboxWorker() {
  console.log(`[Outbox Worker] Iniciado (revisión cada ${POLL_INTERVAL_MS / 1000}s hacia ${AGENDA_SERVICE_URL})`);
  setInterval(procesarPendientes, POLL_INTERVAL_MS);
}

module.exports = {
  iniciarOutboxWorker,
  procesarEventoPorId,
  procesarPendientes
};