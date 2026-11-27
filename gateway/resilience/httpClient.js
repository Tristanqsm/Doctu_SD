const http = require('http');

/**
 * Envía una petición HTTP a una instancia concreta (IP + puerto) con DOS timeouts:
 *
 *  - connectTimeoutMs: tiempo máximo para establecer la conexión TCP.
 *  - timeoutMs: tiempo máximo total hasta recibir la respuesta completa.
 *
 * Si falla, el error trae `conectado`:
 *  - conectado = false -> la conexión TCP nunca se estableció (réplica apagada, IP que
 *    ya no existe, puerto cerrado). El servicio NUNCA vio la petición, así que
 *    reintentarla en otra réplica es seguro incluso para un POST.
 *  - conectado = true  -> la petición pudo llegar y procesarse (ej. timeout esperando
 *    la respuesta). Reintentar un POST aquí podría duplicarlo: solo se reintenta si el
 *    método es idempotente o trae Idempotency-Key.
 *
 * Se usa node:http (y no fetch) precisamente para poder distinguir esos dos casos.
 */
function enviar({ host, port, method = 'GET', path = '/', headers = {}, body = null, connectTimeoutMs = 1000, timeoutMs = 3000 }) {
  return new Promise((resolve, reject) => {
    let conectado = false;
    let terminado = false;
    let timerConexion = null;
    let timerTotal = null;

    const headersFinales = { ...headers };
    if (body) headersFinales['content-length'] = Buffer.byteLength(body);

    // agent: false -> conexión nueva por petición (sin keep-alive): cada petición vuelve
    // a pasar por el balanceador y no se queda pegada a una réplica.
    const req = http.request({ host, port, method, path, headers: headersFinales, agent: false });

    function limpiar() {
      clearTimeout(timerConexion);
      clearTimeout(timerTotal);
    }

    function fallar(err) {
      if (terminado) return;
      terminado = true;
      limpiar();
      err.conectado = conectado;
      req.destroy();
      reject(err);
    }

    timerConexion = setTimeout(() => {
      const err = new Error(`sin conexión TCP en ${connectTimeoutMs}ms`);
      err.code = 'ECONNECTTIMEOUT';
      err.esTimeout = true;
      fallar(err);
    }, connectTimeoutMs);

    timerTotal = setTimeout(() => {
      const err = new Error(`sin respuesta en ${timeoutMs}ms`);
      err.code = 'ETIMEDOUT';
      err.esTimeout = true;
      fallar(err);
    }, timeoutMs);

    req.on('socket', (socket) => {
      socket.once('connect', () => {
        conectado = true;
        clearTimeout(timerConexion);
      });
    });

    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', fallar);
      res.on('end', () => {
        if (terminado) return;
        terminado = true;
        limpiar();
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });

    req.on('error', fallar);

    if (body) req.write(body);
    req.end();
  });
}

module.exports = { enviar };
