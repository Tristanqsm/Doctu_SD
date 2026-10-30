const path = require('path');
const express = require('express');
const session = require('express-session');

// Inicializar la base de datos local SQLite y asegurar tablas
require('./database/db');

const authRoutes = require('./routes/authRoutes');
const medicoRoutes = require('./routes/medicoRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const citaRoutes = require('./routes/citaRoutes');
const expedienteRoutes = require('./routes/expedienteRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Motor de Vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para procesar datos de formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir archivos estáticos (CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// Manejo de Sesiones Monolíticas
app.use(
  session({
    secret: 'doctu-monolito-secreto-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 horas
  })
);

// Middleware para inyectar variables globales en todas las vistas EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// ── RUTAS PRINCIPALES DEL SISTEMA ──

// Página de Inicio / Landing
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.rol === 'medico' ? '/dashboard-medico' : '/portal-paciente');
  }
  res.render('index', {
    title: 'DOCTU · Sistema Clínico Monolítico',
    msg: req.query.msg || null
  });
});

// Módulos del Sistema
app.use('/', authRoutes);
app.use('/', medicoRoutes);
app.use('/', pacienteRoutes);
app.use('/', citaRoutes);
app.use('/', expedienteRoutes);
app.use('/api', apiRoutes);

// Manejo de ruta 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada (404)',
    mensaje: 'La dirección solicitada no existe en este servidor.',
    user: req.session ? req.session.user : null
  });
});

// Manejo de errores 500
app.use((err, req, res, next) => {
  console.error('[Error de Servidor]:', err);
  res.status(500).render('error', {
    title: 'Error Interno del Servidor (500)',
    mensaje: 'Ocurrió un error inesperado al procesar la solicitud.',
    user: req.session ? req.session.user : null
  });
});

// Iniciar servidor monolítico
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`DOCTU`);
  console.log(`Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});

