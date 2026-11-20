const express = require('express');

require('./database/db');

const citaRoutes = require('./routes/citaRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'servicio-agenda',
    timestamp: new Date().toISOString()
  });
});

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