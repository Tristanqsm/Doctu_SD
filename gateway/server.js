const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

function crearProxy(servicioNombre, target, prefijo) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: 5000,
    timeout: 5000,
    pathRewrite: {
      [`^${prefijo}`]: ''
    },
    onError(err, req, res) {
      console.error(`[API Gateway] Error comunicando con ${servicioNombre}:`, err.code || err.message);
      if (res.headersSent) return;

      const status = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' ? 504 : 502;
      res.status(status).json({
        error: status === 504 ? 'Gateway Timeout' : 'Bad Gateway',
        servicio: servicioNombre,
        mensaje: `El microservicio ${servicioNombre} no está disponible en este momento.`
      });
    }
  });
}

app.use('/api/usuarios', crearProxy('servicio-usuarios', 'http://servicio-usuarios:3001', '/api/usuarios'));
app.use('/api/agenda', crearProxy('servicio-agenda', 'http://servicio-agenda:3002', '/api/agenda'));
app.use('/api/expedientes', crearProxy('servicio-expedientes', 'http://servicio-expedientes:3003', '/api/expedientes'));

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    mensaje: 'Ruta no reconocida en el API Gateway.'
  });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] Escuchando tráfico centralizado en el puerto ${PORT}`);
});