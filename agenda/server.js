const express = require('express');

// Inicializar la base de datos
require('./database/db');

// Solo requerimos las rutas correspondientes a la agenda
const citaRoutes = require('./routes/citaRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// ── RUTAS DEL MICROSERVICIO DE AGENDA ──
app.use('/', citaRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', mensaje: 'Ruta de agenda no encontrada.' });
});

app.use((err, req, res, next) => {
  console.error('[Error en Servicio Agenda]:', err);
  res.status(500).json({ error: 'Internal Server Error', mensaje: 'Error procesando la agenda.' });
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`[Microservicio Agenda] Activo y escuchando en puerto ${PORT}`);
  console.log(`=================================================\n`);
});