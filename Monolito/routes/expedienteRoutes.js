const express = require('express');
const router = express.Router();
const expedienteController = require('../controllers/expedienteController');
const { requireAuth, requireMedico } = require('../middleware/auth');

// Funcionalidad de generar nuevo expediente deshabilitada en este prototipo (botones conservados en UI)
router.get('/expedientes/nuevo', requireMedico, (req, res) => {
  res.redirect('/dashboard-medico?error=Función de generar nuevo expediente no disponible en este prototipo.');
});

router.post('/expedientes/nuevo', requireMedico, (req, res) => {
  res.redirect('/dashboard-medico?error=Función de generar nuevo expediente no disponible en este prototipo.');
});

// Lectura de expedientes e historial médico (consultas activas)
router.get('/expedientes/paciente/:id', requireMedico, expedienteController.getHistorialPaciente);
router.get('/expedientes/:id', requireAuth, expedienteController.getVerExpediente);

module.exports = router;
