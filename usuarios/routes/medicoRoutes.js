const express = require('express');
const router = express.Router();
const medicoController = require('../controllers/medicoController');
const { requireMedico } = require('../middleware/auth');

router.get('/dashboard-medico', requireMedico, medicoController.getDashboard);

module.exports = router;

