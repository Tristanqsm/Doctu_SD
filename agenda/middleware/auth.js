const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'doctu_super_secreto_2026';

function extraerYVerificarToken(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      mensaje: 'Token no proporcionado. Incluye Authorization: Bearer <token>.'
    });
    return null;
  }

  const token = authHeader.slice(7).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return decoded;
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      mensaje: 'Token inválido o expirado.'
    });
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = extraerYVerificarToken(req, res);
  if (!user) return;
  next();
}

function requireMedico(req, res, next) {
  const user = extraerYVerificarToken(req, res);
  if (!user) return;

  if (user.rol !== 'medico') {
    return res.status(403).json({
      error: 'Forbidden',
      mensaje: 'Esta operación es exclusiva para personal médico.'
    });
  }
  next();
}

function requirePaciente(req, res, next) {
  const user = extraerYVerificarToken(req, res);
  if (!user) return;

  if (user.rol !== 'paciente') {
    return res.status(403).json({
      error: 'Forbidden',
      mensaje: 'Esta operación es exclusiva para pacientes.'
    });
  }
  next();
}

module.exports = {
  requireAuth,
  requireMedico,
  requirePaciente
};