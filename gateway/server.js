const express = require('express');
const cors = require('cors');
const CircuitBreaker = require('./resilience/circuitBreaker');
const LoadBalancer = require('./resilience/loadBalancer');
const { enviar } = require('./resilience/httpClient');

const app = express();
const PORT = process.env.PORT || 8080;

const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 3000);
const CONNECT_TIMEOUT_MS = Number(process.env.UPSTREAM_CONNECT_TIMEOUT_MS || 1000);
const MAX_RETRIES = Number(process.env.GATEWAY_MAX_RETRIES || 2);
const BASE_BACKOFF_MS = Number(process.env.GATEWAY_BASE_BACKOFF_MS || 250);
const CB_FAILURE_THRESHOLD = Number(process.env.CB_FAILURE_THRESHOLD || 3);
const CB_RESET_TIMEOUT_MS = Number(process.env.CB_RESET_TIMEOUT_MS || 15000);
const LB_INTERVAL_MS = Number(process.env.LB_INTERVAL_MS || 5000);
const LB_HEALTH_TIMEOUT_MS = Number(process.env.LB_HEALTH_TIMEOUT_MS || 1500);

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

// Servicios internos: nombre en el DNS de Docker (directorio) + puerto interno
const SERVICIOS = {
  'servicio-usuarios': 3001,
  'servicio-agenda': 3002,
  'servicio-expedientes': 3003
};

const breakers = {};
const balanceadores = {};
for (const [nombre, puerto] of Object.entries(SERVICIOS)) {
  breakers[nombre] = new CircuitBreaker(nombre, {
    failureThreshold: CB_FAILURE_THRESHOLD,
    resetTimeoutMs: CB_RESET_TIMEOUT_MS
  });
  balanceadores[nombre] = new LoadBalancer(nombre, puerto, {
    intervaloMs: LB_INTERVAL_MS,
    healthTimeoutMs: LB_HEALTH_TIMEOUT_MS
  }).iniciar();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapear(objeto, fn) {
  return Object.fromEntries(Object.entries(objeto).map(([k, v]) => [k, fn(v)]));
}

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    circuitBreakers: mapear(breakers, (b) => b.getStatus()),
    balanceadores: mapear(balanceadores, (lb) => lb.getStatus())
  });
});

function crearProxyResiliente(servicioNombre) {
  const breaker = breakers[servicioNombre];
  const balanceador = balanceadores[servicioNombre];
  const puerto = SERVICIOS[servicioNombre];

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

    const tieneIdempotencyKey = Boolean(req.headers['idempotency-key']);
    // ¿Es seguro repetir la petición aunque el servicio ya la haya recibido?
    const puedeReintentar = IDEMPOTENT_METHODS.has(req.method) || tieneIdempotencyKey;
    const intentosMaximos = MAX_RETRIES + 1;

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
    let intentosHechos = 0;
    // Réplicas que ya fallaron en esta petición: el reintento va a OTRA réplica
    const yaIntentadas = new Set();

    // 2. Ejecutar petición con balanceo, reintentos y backoff exponencial
    for (let intento = 1; intento <= intentosMaximos; intento++) {
      intentosHechos = intento;
      let instancia = balanceador.elegir(yaIntentadas);
      if (!instancia && !balanceador.ultimoRefresco) {
        // El gateway acaba de arrancar y aún no termina su primera consulta al directorio
        await balanceador.refrescar();
        instancia = balanceador.elegir(yaIntentadas);
      }
      if (!instancia) {
        // El DNS de Docker no reporta ningún contenedor vivo: no tiene caso intentar
        ultimoStatus = 503;
        ultimoError = 'sin instancias registradas en el DNS de Docker';
        break;
      }
      const host = instancia.ip;

      try {
        const upstreamResp = await enviar({
          host,
          port: puerto,
          method: req.method,
          path: req.url,
          headers: headersReenvio,
          body: tieneBody ? req.body : null,
          connectTimeoutMs: CONNECT_TIMEOUT_MS,
          timeoutMs: UPSTREAM_TIMEOUT_MS
        });

        // Errores >=500 del microservicio se consideran fallo y pueden reintentarse
        if (upstreamResp.status >= 500) {
          ultimoStatus = upstreamResp.status;
          ultimoError = `HTTP ${upstreamResp.status}`;
          yaIntentadas.add(instancia.ip);

          if (puedeReintentar && intento < intentosMaximos) {
            const espera = BASE_BACKOFF_MS * Math.pow(2, intento - 1);
            console.warn(
              `[Retry][${servicioNombre}] ${host} respondió ${upstreamResp.status}. Reintento ${intento + 1}/${intentosMaximos} en ${espera}ms...`
            );
            await sleep(espera);
            continue;
          }

          breaker.recordFailure(ultimoError);
          res.setHeader('X-Circuit-State', breaker.state);
          res.setHeader('X-Retry-Attempts', String(intento));
          if (upstreamResp.headers['x-served-by']) res.setHeader('X-Served-By', upstreamResp.headers['x-served-by']);
          return res.status(upstreamResp.status).type('application/json').send(
            upstreamResp.body.length > 0
              ? upstreamResp.body
              : JSON.stringify({
                  error: 'Upstream Error',
                  servicio: servicioNombre,
                  circuit_state: breaker.state,
                  mensaje: `Error interno en ${servicioNombre}.`
                })
          );
        }

        // Respuesta 200's / 300's / 400's indica que el servicio está sano
        breaker.recordSuccess();

        const contentType = upstreamResp.headers['content-type'];
        const etag = upstreamResp.headers['etag'];
        const servedBy = upstreamResp.headers['x-served-by'];

        if (contentType) res.setHeader('Content-Type', contentType);
        if (etag) res.setHeader('ETag', etag);
        if (servedBy) res.setHeader('X-Served-By', servedBy);

        res.setHeader('X-Circuit-State', breaker.state);
        res.setHeader('X-Retry-Attempts', String(intento));

        if (upstreamResp.status === 204 || upstreamResp.status === 304) {
          return res.status(upstreamResp.status).end();
        }

        return res.status(upstreamResp.status).send(upstreamResp.body);
      } catch (err) {
        ultimoStatus = err.esTimeout ? 504 : 502;
        ultimoError = `${host}: ${err.message}`;

        yaIntentadas.add(instancia.ip);
        balanceador.reportarFallo(instancia.ip, err.message);

        // Si la conexión TCP nunca se abrió, el servicio no vio la petición:
        // reintentar en otra réplica es seguro incluso para un POST sin Idempotency-Key.
        const nuncaLlego = !err.conectado;

        if ((puedeReintentar || nuncaLlego) && intento < intentosMaximos) {
          const espera = BASE_BACKOFF_MS * Math.pow(2, intento - 1);
          console.warn(
            `[Retry][${servicioNombre}] Error de red con ${host} (${err.message})` +
            `${nuncaLlego ? ' [la petición no llegó]' : ''}. Reintento ${intento + 1}/${intentosMaximos} en ${espera}ms en otra réplica...`
          );
          await sleep(espera);
          continue;
        }
        break;
      }
    }

    // 3. Si agotó los reintentos, registrar fallo en el Circuit Breaker
    breaker.recordFailure(ultimoError || 'Error de conexión');
    res.setHeader('X-Circuit-State', breaker.state);
    res.setHeader('X-Retry-Attempts', String(intentosHechos));

    const etiquetas = { 503: 'Service Unavailable', 504: 'Gateway Timeout' };
    return res.status(ultimoStatus).json({
      error: etiquetas[ultimoStatus] || 'Bad Gateway',
      servicio: servicioNombre,
      intentos: intentosHechos,
      circuit_state: breaker.state,
      degradado: true,
      mensaje: `El microservicio ${servicioNombre} no está disponible en este momento.`
    });
  };
}

app.use('/api/usuarios', crearProxyResiliente('servicio-usuarios'));
app.use('/api/agenda', crearProxyResiliente('servicio-agenda'));
app.use('/api/expedientes', crearProxyResiliente('servicio-expedientes'));

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    mensaje: 'Ruta no reconocida en el API Gateway.'
  });
});

app.listen(PORT, () => {
  console.log(
    `[API Gateway] Escuchando en puerto ${PORT} (balanceo round-robin + health check, Circuit Breaker y Retries)`
  );
});
