const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');
const { requireAuth } = require('../middleware/auth');

// Funcionalidad de agendar cita deshabilitada en este prototipo (botones conservados en UI)
router.get('/citas/nueva', requireAuth, (req, res) => {
  const dest = req.session.user.rol === 'medico' ? '/dashboard-medico' : '/portal-paciente';
  res.redirect(`${dest}?error=Función de agendar cita no disponible en este prototipo.`);
});

router.post('/citas/nueva', requireAuth, (req, res) => {
  const dest = req.session.user.rol === 'medico' ? '/dashboard-medico' : '/portal-paciente';
  res.redirect(`${dest}?error=Función de agendar cita no disponible en este prototipo.`);
});

router.post('/citas/:id/estado', requireAuth, citaController.updateEstadoCita);

module.exports = router;
