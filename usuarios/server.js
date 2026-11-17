const express = require('express');

// Inicializar la base de datos local SQLite y asegurar tablas
require('./database/db');

// SOLO conservamos las rutas relacionadas con usuarios (PII y Perfiles)
const authRoutes = require('./routes/authRoutes');
const medicoRoutes = require('./routes/medicoRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware para procesar JSON 
app.use(express.json());

// ── RUTAS DEL MICROSERVICIO DE USUARIOS ──
app.use('/', authRoutes);
app.use('/', medicoRoutes);
app.use('/', pacienteRoutes);

// Manejo de ruta 404 
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found', 
    mensaje: 'La ruta solicitada no existe en el microservicio de Usuarios.' 
  });
});

// Manejo de errores 500 
app.use((err, req, res, next) => {
  console.error('[Error en Servicio Usuarios]:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    mensaje: 'Error inesperado al procesar los datos de usuario.' 
  });
});

// Iniciar microservicio
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`[Microservicio Usuarios] Activo y escuchando en puerto ${PORT}`);
  console.log(`=================================================\n`);
});