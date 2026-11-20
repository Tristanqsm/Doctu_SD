const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { requireAuth, requireMedico } = require('../middleware/auth');

router.get('/perfil', requireAuth, usuarioController.getPerfil);
router.get('/medicos', requireAuth, usuarioController.getMedicos);
router.get('/pacientes', requireMedico, usuarioController.getPacientes);
router.get('/batch', requireAuth, usuarioController.getUsuariosBatch);
router.get('/:id', requireAuth, usuarioController.getUsuarioPorId);

module.exports = router;