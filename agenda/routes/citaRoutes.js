const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');
const { requireAuth } = require('../middleware/auth');

router.get('/citas', requireAuth, citaController.getCitas);
router.get('/citas/:id', requireAuth, citaController.getCitaPorId);
router.post('/citas', requireAuth, citaController.postNuevaCita);
router.post('/citas/:id/estado', requireAuth, citaController.updateEstadoCita);

module.exports = router;