const db = require('../database/db');

// Procesar inicio de sesión (Endpoint REST)
function login(req, res) {
  const { email, password, rol } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Por favor, ingresa tu correo y contraseña.' });
  }

  try {
    const user = db.prepare(`
      SELECT id, email, password, rol, nombre_completo, especialidad, cedula, curp, telefono
      FROM usuarios
      WHERE email = ? AND rol = ?
    `).get(email.trim().toLowerCase(), rol || 'paciente');

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo, contraseña y rol.' });
    }

    console.log(`[Microservicio Auth] Inicio de sesión exitoso: ${user.nombre_completo} (${user.rol})`);

    // Devolvemos el JSON con los datos y un token de prueba (placeholder)
    return res.status(200).json({
      message: 'Login exitoso',
      token: 'jwt_temporal_hasta_configurar_la_libreria',
      user: {
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
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno al procesar inicio de sesión.' });
  }
}

// Procesar registro de nuevo usuario (Endpoint REST)
function registro(req, res) {
  const { rol, nombreCompleto, email, password, telefono, curp, especialidad, cedula } = req.body;

  if (!nombreCompleto || !email || !password) {
    return res.status(400).json({ error: 'Nombre completo, correo y contraseña son obligatorios.' });
  }

  try {
    // Verificar si el correo ya existe
    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    if (existente) {
      return res.status(409).json({ error: 'Ese correo ya se encuentra registrado.' });
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
    
    return res.status(201).json({ message: 'Cuenta creada exitosamente.' });
  } catch (err) {
    console.error('Error en registro:', err);
    return res.status(500).json({ error: 'Error al registrar la cuenta: ' + err.message });
  }
}

// Cerrar sesión (Endpoint REST)
function logout(req, res) {
  // Aquí solo devolvemos una confirmación de éxito.
  return res.status(200).json({ message: 'Sesión cerrada correctamente. Elimina el token en el cliente.' });
}

module.exports = {
  login,
  registro,
  logout
};