const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const { requirePaciente } = require('../middleware/auth');

router.get('/portal-paciente', requirePaciente, pacienteController.getPortal);

module.exports = router;

