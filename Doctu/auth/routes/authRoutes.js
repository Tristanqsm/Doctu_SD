const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Endpoints REST para el microservicio de autenticación
router.post('/login', authController.login);
router.post('/registro', authController.registro);

//  POST para el logout
router.post('/logout', authController.logout);

module.exports = router;

