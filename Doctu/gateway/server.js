const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// --- Enrutamiento a Microservicios ---

// Redirige todo lo que empiece con /api/auth al Servicio de Autenticación
app.use('/api/auth', createProxyMiddleware({ 
    target: 'http://servicio-auth:3001', 
    changeOrigin: true 
}));

// Aquí se irán agregando los demás servicios conforme se separe el monolito
// app.use('/api/pacientes', createProxyMiddleware({ target: 'http://localhost:3002', changeOrigin: true }));
// app.use('/api/medicos', createProxyMiddleware({ target: 'http://localhost:3003', changeOrigin: true }));
// app.use('/api/citas', createProxyMiddleware({ target: 'http://localhost:3004', changeOrigin: true }));
// app.use('/api/expedientes', createProxyMiddleware({ target: 'http://localhost:3005', changeOrigin: true }));

app.listen(PORT, () => {
    console.log(`API Gateway inicializado y escuchando en el puerto ${PORT}`);
});