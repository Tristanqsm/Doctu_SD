const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080; 

app.use(cors());

// Enrutamiento hacia el microservicio de usuarios (PII y Perfiles)
app.use('/api/usuarios', createProxyMiddleware({ 
    target: 'http://servicio-usuarios:3001', 
    changeOrigin: true,
    pathRewrite: {
        '^/api/usuarios': '' 
    }
}));

app.listen(PORT, () => {
    console.log(`[API Gateway] Escuchando tráfico centralizado en el puerto ${PORT}`);
});

