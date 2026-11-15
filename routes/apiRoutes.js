const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/health', apiController.getHealth);
router.get('/pacientes', apiController.getPacientes);
router.get('/citas', apiController.getCitas);
router.get('/expedientes', apiController.getExpedientes);

module.exports = router;

