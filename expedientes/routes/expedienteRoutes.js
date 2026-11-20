const express = require('express');
const router = express.Router();
const expedienteController = require('../controllers/expedienteController');
const { requireAuth, requireMedico } = require('../middleware/auth');

router.get('/expedientes', requireAuth, expedienteController.getExpedientes);
router.get('/expedientes/paciente/:id', requireMedico, expedienteController.getHistorialPaciente);
router.get('/expedientes/:id', requireAuth, expedienteController.getVerExpediente);
router.post('/expedientes', requireMedico, expedienteController.postNuevoExpediente);

module.exports = router;