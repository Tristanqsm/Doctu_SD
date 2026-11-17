const db = require('../database/db');
const jwt = require('jsonwebtoken'); 

// La llave secreta para firmar los tokens (En producción esto va en un archivo .env oculto)
const JWT_SECRET = 'doctu_super_secreto_2026';

// Procesar login (API)
function postLogin(req, res) {
  const { email, password, rol } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Por favor, ingresa tu correo y contraseña.'
    });
  }

  try {
    const user = db.prepare(`
      SELECT id, email, password, rol, nombre_completo, especialidad, cedula, curp, telefono
      FROM usuarios
      WHERE email = ? AND rol = ?
    `).get(email.trim().toLowerCase(), rol || 'paciente');

    if (!user || user.password !== password) {
      return res.status(401).json({
        error: 'Unauthorized',
        mensaje: 'Credenciales inválidas. Verifica tu correo, contraseña y rol seleccionado.'
      });
    }

    //  AQUÍ FABRICAMOS EL TOKEN
    // Metemos datos clave (payload) pero NUNCA contraseñas ni datos sensibles (PII)
    const token = jwt.sign(
      { id: user.id, rol: user.rol, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '24h' } // El token caduca en un día
    );

    console.log(`[Microservicio Auth] Inicio de sesión exitoso. Token generado para: ${user.nombre_completo}`);

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token: token, // <-- Enviamos el token al frontend
      usuario: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        nombre: user.nombre_completo
      }
    });

  } catch (err) {
    console.error('Error en postLogin:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: 'Error interno al procesar inicio de sesión.'
    });
  }
}

// Procesar registro (API)
function postRegistro(req, res) {
  const { rol, nombreCompleto, email, password, telefono, curp, especialidad, cedula } = req.body;

  if (!nombreCompleto || !email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Nombre completo, correo y contraseña son obligatorios.'
    });
  }

  try {
    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    if (existente) {
      return res.status(409).json({
        error: 'Conflict',
        mensaje: 'Ese correo ya se encuentra registrado.'
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

    console.log(`[Microservicio Auth] Nuevo usuario registrado: ${nombreCompleto} (${rol})`);
    
    return res.status(201).json({
      mensaje: 'Cuenta creada exitosamente.',
      usuario: { email: email.trim().toLowerCase(), rol: rol || 'paciente' }
    });

  } catch (err) {
    console.error('Error en postRegistro:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: 'Error al registrar la cuenta: ' + err.message
    });
  }
}

// Cerrar sesión
function logout(req, res) {
  return res.status(200).json({
    mensaje: 'Sesión cerrada. El frontend debe eliminar el token JWT de su memoria.'
  });
}

module.exports = {
  postLogin,
  postRegistro,
  logout
};