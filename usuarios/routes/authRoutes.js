const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ── RUTAS API DEL MICROSERVICIO DE USUARIOS (Solo JSON) ──

// Procesar inicio de sesión
router.post('/login', authController.postLogin);

// Procesar registro de nuevo usuario
router.post('/registro', authController.postRegistro);

// Cerrar sesión 
router.post('/logout', authController.logout);

module.exports = router;