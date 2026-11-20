const db = require('../database/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'doctu_super_secreto_2026';

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

    const token = jwt.sign(
      { id: user.id, rol: user.rol, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Microservicio Usuarios] Token JWT generado para: ${user.nombre_completo} (${user.rol})`);

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        nombre: user.nombre_completo,
        especialidad: user.especialidad,
        cedula: user.cedula,
        curp: user.curp,
        telefono: user.telefono
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

function postRegistro(req, res) {
  const { rol, nombreCompleto, email, password, telefono, curp, especialidad, cedula } = req.body;

  if (!nombreCompleto || !email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Nombre completo, correo y contraseña son obligatorios.'
    });
  }

  try {
    const emailNormalizado = email.trim().toLowerCase();
    const rolFinal = rol || 'paciente';

    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNormalizado);
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

    const info = insert.run(
      emailNormalizado,
      password,
      rolFinal,
      nombreCompleto.trim(),
      telefono || null,
      rolFinal === 'paciente' ? (curp || null) : null,
      rolFinal === 'medico' ? (especialidad || 'Medicina General') : null,
      rolFinal === 'medico' ? (cedula || null) : null
    );

    console.log(`[Microservicio Usuarios] Nuevo usuario registrado: ${nombreCompleto} (${rolFinal})`);

    return res.status(201).json({
      mensaje: 'Cuenta creada exitosamente.',
      usuario: {
        id: info.lastInsertRowid,
        email: emailNormalizado,
        rol: rolFinal,
        nombre: nombreCompleto.trim()
      }
    });
  } catch (err) {
    console.error('Error en postRegistro:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      mensaje: 'Error al registrar la cuenta: ' + err.message
    });
  }
}

function logout(req, res) {
  return res.status(200).json({
    mensaje: 'Sesión cerrada. El frontend debe eliminar el token JWT.'
  });
}

module.exports = {
  postLogin,
  postRegistro,
  logout
};