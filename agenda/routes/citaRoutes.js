const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');

//  RUTAS API DEL MICROSERVICIO DE AGENDA  

// GET: Obtener listas de médicos y pacientes para los menús desplegables del frontend
router.get('/citas/referencias', citaController.getReferencias);

// POST: Crear una nueva cita
router.post('/citas', citaController.postNuevaCita);

// POST: Actualizar el estado de una cita existente
router.post('/citas/:id/estado', citaController.updateEstadoCita);

module.exports = router;