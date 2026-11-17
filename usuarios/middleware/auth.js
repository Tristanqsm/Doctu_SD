function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    req.session.redirectAfterLogin = req.originalUrl;
    return res.redirect('/login?error=Debes iniciar sesión para acceder');
  }
  next();
}

function requireMedico(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login?error=Debes iniciar sesión');
  }
  if (req.session.user.rol !== 'medico') {
    return res.status(403).render('error', {
      title: 'Acceso Denegado',
      mensaje: 'Esta sección es exclusiva para personal médico.',
      user: req.session.user
    });
  }
  next();
}

function requirePaciente(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login?error=Debes iniciar sesión');
  }
  if (req.session.user.rol !== 'paciente') {
    return res.status(403).render('error', {
      title: 'Acceso Denegado',
      mensaje: 'Esta sección es exclusiva para pacientes.',
      user: req.session.user
    });
  }
  next();
}

module.exports = {
  requireAuth,
  requireMedico,
  requirePaciente
};

