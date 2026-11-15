const express = require('express');
const router = express.Router();
const expedienteController = require('../controllers/expedienteController');
const { requireAuth, requireMedico } = require('../middleware/auth');

router.get('/expedientes/nuevo', requireMedico, expedienteController.getNuevoExpediente);
router.post('/expedientes/nuevo', requireMedico, expedienteController.postNuevoExpediente);
router.get('/expedientes/paciente/:id', requireMedico, expedienteController.getHistorialPaciente);
router.get('/expedientes/:id', requireAuth, expedienteController.getVerExpediente);

module.exports = router;