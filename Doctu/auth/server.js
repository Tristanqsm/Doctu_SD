const express = require('express');
require('./database/db'); // Inicializa la base de datos local SQLite

const authRoutes = require('./routes/authRoutes');

const app = express();
// Cambiamos el puerto al 3001 para que no choque con el Gateway (3000)
const PORT = process.env.PORT || 3001; 

// Middlewares para procesar JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── RUTAS DEL MICROSERVICIO ──
app.use('/', authRoutes); 

// Manejo de ruta 404 (Formato JSON)
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada en el microservicio de autenticación (404)'
  });
});

// Manejo de errores 500 (Formato JSON)
app.use((err, req, res, next) => {
  console.error('[Error de Servidor Auth]:', err);
  res.status(500).json({
    error: 'Ocurrió un error inesperado en el servicio de autenticación.'
  });
});

// Iniciar microservicio
app.listen(PORT, () => {
  console.log(`[Servicio Auth] Ejecutándose en: http://localhost:${PORT}`);
});

