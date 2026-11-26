const express = require('express');
const cors = require('cors');
const CircuitBreaker = require('./resilience/circuitBreaker');

const app = express();
const PORT = process.env.PORT || 8080;

const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 3000);
const MAX_RETRIES = Number(process.env.GATEWAY_MAX_RETRIES || 2);
const BASE_BACKOFF_MS = Number(process.env.GATEWAY_BASE_BACKOFF_MS || 250);
const CB_FAILURE_THRESHOLD = Number(process.env.CB_FAILURE_THRESHOLD || 3);
const CB_RESET_TIMEOUT_MS = Number(process.env.CB_RESET_TIMEOUT_MS || 15000);

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['X-Circuit-State', 'X-Retry-Attempts', 'X-Served-By']
  })
);

// Captura el cuerpo crudo para poder reenviarlo de forma segura en caso de reintento
app.use(express.raw({ type: '*/*', limit: '5mb' }));

const breakers = {
  'servicio-usuarios': new CircuitBreaker('servicio-usuarios', {
    failureThreshold: CB_FAILURE_THRESHOLD,
    resetTimeoutMs: CB_RESET_TIMEOUT_MS
  }),
  'servicio-agenda': new CircuitBreaker('servicio-agenda', {
    failureThreshold: CB_FAILURE_THRESHOLD,
    resetTimeoutMs: CB_RESET_TIMEOUT_MS
  }),
  'servicio-expedientes': new CircuitBreaker('servicio-expedientes', {
    failureThreshold: CB_FAILURE_THRESHOLD,
    resetTimeoutMs: CB_RESET_TIMEOUT_MS
  })
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    circuitBreakers: {
      'servicio-usuarios': breakers['servicio-usuarios'].getStatus(),
      'servicio-agenda': breakers['servicio-agenda'].getStatus(),
      'servicio-expedientes': breakers['servicio-expedientes'].getStatus()
    }
  });
});

function crearProxyResiliente(servicioNombre, target) {
  const breaker = breakers[servicioNombre];

  return async (req, res) => {
    // 1. Verificar estado del Circuit Breaker (Fail-Fast si está OPEN)
    if (!breaker.canRequest()) {
      const retryAfter = breaker.getRetryAfterSeconds();
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-Circuit-State', breaker.state);

      return res.status(503).json({
        error: 'Service Unavailable',
        servicio: servicioNombre,
        circuit_state: breaker.state,
        retry_after_seconds: retryAfter,
        degradado: true,
        mensaje: `Circuito abierto para ${servicioNombre}. Intenta de nuevo en ${retryAfter}s.`
      });
    }

    const destino = `${target}${req.url}`;
    const tieneIdempotencyKey = Boolean(req.headers['idempotency-key']);
    const puedeReintentar = IDEMPOTENT_METHODS.has(req.method) || tieneIdempotencyKey;
    const intentosMaximos = puedeReintentar ? MAX_RETRIES + 1 : 1;

    const headersReenvio = {
      connection: 'close'
    };
    for (const h of ['authorization', 'content-type', 'idempotency-key', 'accept', 'if-none-match']) {
      if (req.headers[h]) {
        headersReenvio[h] = req.headers[h];
      }
    }

    const tieneBody =
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      Buffer.isBuffer(req.body) &&
      req.body.length > 0;

    let ultimoError = null;
    let ultimoStatus = 502;

    // 2. Ejecutar petición con reintentos y backoff exponencial
    for (let intento = 1; intento <= intentosMaximos; intento++) {
      try {
        const upstreamResp = await fetch(destino, {
          method: req.method,
          headers: headersReenvio,
          body: tieneBody ? req.body : undefined,
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
        });

        // Errores >500 del microservicio se consideran fallo y pueden reintentarse
        if (upstreamResp.status >= 500) {
          ultimoStatus = upstreamResp.status;
          ultimoError = `HTTP ${upstreamResp.status}`;

          if (intento < intentosMaximos) {
            const espera = BASE_BACKOFF_MS * Math.pow(2, intento - 1);
            console.warn(
              `[Retry][${servicioNombre}] Respuesta ${upstreamResp.status}. Reintento ${intento + 1}/${intentosMaximos} en ${espera}ms...`
            );
            await sleep(espera);
            continue;
          }

          breaker.recordFailure(ultimoError);
          const bodyErr = await upstreamResp.text();
          res.setHeader('X-Circuit-State', breaker.state);
          res.setHeader('X-Retry-Attempts', String(intento));
          return res.status(upstreamResp.status).type('application/json').send(
            bodyErr ||
              JSON.stringify({
                error: 'Upstream Error',
                servicio: servicioNombre,
                circuit_state: breaker.state,
                mensaje: `Error interno en ${servicioNombre}.`
              })
          );
        }

        // Respuesta 200's / 300's / 400's indica que el servicio está sano
        breaker.recordSuccess();

        const contentType = upstreamResp.headers.get('content-type');
        const etag = upstreamResp.headers.get('etag');
        const servedBy = upstreamResp.headers.get('x-served-by');

        if (contentType) res.setHeader('Content-Type', contentType);
        if (etag) res.setHeader('ETag', etag);
        if (servedBy) res.setHeader('X-Served-By', servedBy);

        res.setHeader('X-Circuit-State', breaker.state);
        res.setHeader('X-Retry-Attempts', String(intento));

        if (upstreamResp.status === 204 || upstreamResp.status === 304) {
          return res.status(upstreamResp.status).end();
        }

        const responseBuffer = Buffer.from(await upstreamResp.arrayBuffer());
        return res.status(upstreamResp.status).send(responseBuffer);
      } catch (err) {
        const esTimeout = err.name === 'TimeoutError' || err.code === 'ETIMEDOUT';
        ultimoStatus = esTimeout ? 504 : 502;
        ultimoError = esTimeout ? 'Timeout agotado' : err.message;

        if (intento < intentosMaximos) {
          const espera = BASE_BACKOFF_MS * Math.pow(2, intento - 1);
          console.warn(
            `[Retry][${servicioNombre}] Error de red (${ultimoError}). Reintento ${intento + 1}/${intentosMaximos} en ${espera}ms...`
          );
          await sleep(espera);
          continue;
        }
      }
    }

    // 3. Si agotó los reintentos, registrar fallo en el Circuit Breaker
    breaker.recordFailure(ultimoError || 'Error de conexión');
    res.setHeader('X-Circuit-State', breaker.state);
    res.setHeader('X-Retry-Attempts', String(intentosMaximos));

    return res.status(ultimoStatus).json({
      error: ultimoStatus === 504 ? 'Gateway Timeout' : 'Bad Gateway',
      servicio: servicioNombre,
      intentos: intentosMaximos,
      circuit_state: breaker.state,
      degradado: true,
      mensaje: `El microservicio ${servicioNombre} no está disponible en este momento.`
    });
  };
}

app.use('/api/usuarios', crearProxyResiliente('servicio-usuarios', 'http://servicio-usuarios:3001'));
app.use('/api/agenda', crearProxyResiliente('servicio-agenda', 'http://servicio-agenda:3002'));
app.use('/api/expedientes', crearProxyResiliente('servicio-expedientes', 'http://servicio-expedientes:3003'));

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    mensaje: 'Ruta no reconocida en el API Gateway.'
  });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] Escuchando tráfico centralizado con Circuit Breaker y Retries en puerto ${PORT}`);
});