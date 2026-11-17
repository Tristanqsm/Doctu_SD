const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');
const { requireAuth } = require('../middleware/auth');

router.get('/citas/nueva', requireAuth, citaController.getNuevaCita);
router.post('/citas/nueva', requireAuth, citaController.postNuevaCita);
router.post('/citas/:id/estado', requireAuth, citaController.updateEstadoCita);

module.exports = router;