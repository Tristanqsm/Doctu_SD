const express = require('express');

require('./database/db');

const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'servicio-usuarios',
    timestamp: new Date().toISOString()
  });
});

app.use('/', authRoutes);
app.use('/', usuarioRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    mensaje: 'La ruta solicitada no existe en el microservicio de Usuarios.'
  });
});

app.use((err, req, res, next) => {
  console.error('[Error en Servicio Usuarios]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    mensaje: 'Error inesperado al procesar los datos de usuario.'
  });
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`[Microservicio Usuarios] Activo y escuchando en puerto ${PORT}`);
  console.log(`=================================================\n`);
});