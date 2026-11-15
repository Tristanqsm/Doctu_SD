const db = require('../database/db');

// Renderizar pantalla de login
function getLogin(req, res) {
  if (req.session.user) {
    return res.redirect(req.session.user.rol === 'medico' ? '/dashboard-medico' : '/portal-paciente');
  }

  const error = req.query.error || null;
  const success = req.query.success || null;
  const rol = req.query.rol || 'paciente';

  res.render('login', {
    title: 'Iniciar Sesión',
    error,
    success,
    rolDefecto: rol,
    user: null
  });
}

// Procesar formulario de login
function postLogin(req, res) {
  const { email, password, rol } = req.body;

  if (!email || !password) {
    return res.render('login', {
      title: 'Iniciar Sesión',
      error: 'Por favor, ingresa tu correo y contraseña.',
      success: null,
      rolDefecto: rol || 'paciente',
      user: null
    });
  }

  try {
    const user = db.prepare(`
      SELECT id, email, password, rol, nombre_completo, especialidad, cedula, curp, telefono
      FROM usuarios
      WHERE email = ? AND rol = ?
    `).get(email.trim().toLowerCase(), rol || 'paciente');

    if (!user || user.password !== password) {
      return res.render('login', {
        title: 'Iniciar Sesión',
        error: 'Credenciales inválidas. Verifica tu correo, contraseña y rol seleccionado.',
        success: null,
        rolDefecto: rol || 'paciente',
        user: null
      });
    }

    // Guardar usuario en sesión
    req.session.user = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre_completo,
      especialidad: user.especialidad,
      cedula: user.cedula,
      curp: user.curp,
      telefono: user.telefono
    };

    console.log(`[Monolito] Sesión iniciada: ${user.nombre_completo} (${user.rol})`);

    // Redirección según rol
    if (user.rol === 'medico') {
      res.redirect('/dashboard-medico');
    } else {
      res.redirect('/portal-paciente');
    }
  } catch (err) {
    console.error('Error en postLogin:', err);
    res.render('login', {
      title: 'Iniciar Sesión',
      error: 'Error interno al procesar inicio de sesión.',
      success: null,
      rolDefecto: rol || 'paciente',
      user: null
    });
  }
}

// Renderizar pantalla de registro
function getRegistro(req, res) {
  if (req.session.user) {
    return res.redirect(req.session.user.rol === 'medico' ? '/dashboard-medico' : '/portal-paciente');
  }

  const rol = req.query.rol || 'paciente';
  res.render('registro', {
    title: 'Crear Cuenta',
    error: null,
    success: null,
    rolDefecto: rol,
    user: null
  });
}

// Procesar registro
function postRegistro(req, res) {
  const { rol, nombreCompleto, email, password, telefono, curp, especialidad, cedula } = req.body;

  if (!nombreCompleto || !email || !password) {
    return res.render('registro', {
      title: 'Crear Cuenta',
      error: 'Nombre completo, correo y contraseña son obligatorios.',
      success: null,
      rolDefecto: rol || 'paciente',
      user: null
    });
  }

  try {
    // Verificar si el correo ya existe
    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    if (existente) {
      return res.render('registro', {
        title: 'Crear Cuenta',
        error: 'Ese correo ya se encuentra registrado.',
        success: null,
        rolDefecto: rol,
        user: null
      });
    }

    const insert = db.prepare(`
      INSERT INTO usuarios (email, password, rol, nombre_completo, telefono, curp, especialidad, cedula)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      email.trim().toLowerCase(),
      password,
      rol || 'paciente',
      nombreCompleto.trim(),
      telefono || null,
      rol === 'paciente' ? (curp || null) : null,
      rol === 'medico' ? (especialidad || 'Medicina General') : null,
      rol === 'medico' ? (cedula || null) : null
    );

    console.log(`[Monolito] Nuevo usuario registrado: ${nombreCompleto} (${rol})`);
    res.redirect(`/login?success=Cuenta creada exitosamente. Ya puedes ingresar.&rol=${rol}`);
  } catch (err) {
    console.error('Error en postRegistro:', err);
    res.render('registro', {
      title: 'Crear Cuenta',
      error: 'Error al registrar la cuenta: ' + err.message,
      success: null,
      rolDefecto: rol || 'paciente',
      user: null
    });
  }
}

// Cerrar sesión
function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/?msg=Sesión cerrada correctamente');
  });
}

module.exports = {
  getLogin,
  postLogin,
  getRegistro,
  postRegistro,
  logout
};

