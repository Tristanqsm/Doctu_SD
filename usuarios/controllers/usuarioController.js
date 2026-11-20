const db = require('../database/db');

function getPerfil(req, res) {
  try {
    const user = db.prepare(`
      SELECT id, email, rol, nombre_completo, telefono, curp, especialidad, cedula, creado_en
      FROM usuarios
      WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Not Found', mensaje: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
      usuario: {
        id: user.id,
        email: user.email,
        rol: user.rol,
        nombre: user.nombre_completo,
        telefono: user.telefono,
        curp: user.curp,
        especialidad: user.especialidad,
        cedula: user.cedula,
        creado_en: user.creado_en
      }
    });
  } catch (err) {
    console.error('Error en getPerfil:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function getMedicos(req, res) {
  try {
    const medicos = db.prepare(`
      SELECT id, nombre_completo, email, telefono, especialidad, cedula
      FROM usuarios
      WHERE rol = 'medico'
      ORDER BY nombre_completo ASC
    `).all();

    return res.status(200).json({ medicos });
  } catch (err) {
    console.error('Error en getMedicos:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function getPacientes(req, res) {
  const busqueda = (req.query.q || '').trim();

  try {
    let pacientes;
    if (busqueda) {
      const patron = `%${busqueda}%`;
      pacientes = db.prepare(`
        SELECT id, nombre_completo, email, telefono, curp, creado_en
        FROM usuarios
        WHERE rol = 'paciente' AND (nombre_completo LIKE ? OR curp LIKE ? OR email LIKE ?)
        ORDER BY nombre_completo ASC
      `).all(patron, patron, patron);
    } else {
      pacientes = db.prepare(`
        SELECT id, nombre_completo, email, telefono, curp, creado_en
        FROM usuarios
        WHERE rol = 'paciente'
        ORDER BY nombre_completo ASC
      `).all();
    }

    return res.status(200).json({ busqueda, pacientes });
  } catch (err) {
    console.error('Error en getPacientes:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function getUsuariosBatch(req, res) {
  const rawIds = (req.query.ids || '').trim();
  if (!rawIds) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Proporciona el parámetro ids, por ejemplo: ?ids=1,3,4'
    });
  }

  const ids = [...new Set(
    rawIds.split(',')
      .map(id => Number(id.trim()))
      .filter(id => Number.isInteger(id) && id > 0)
  )];

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'IDs inválidos.' });
  }

  try {
    const placeholders = ids.map(() => '?').join(', ');
    const filas = db.prepare(`
      SELECT id, rol, nombre_completo, email, telefono, curp, especialidad, cedula
      FROM usuarios
      WHERE id IN (${placeholders})
    `).all(...ids);

    const usuarios = filas
      .filter(u => req.user.rol === 'medico' || u.rol === 'medico' || u.id === req.user.id)
      .map(u => {
        if (u.rol === 'medico') {
          return {
            id: u.id,
            rol: u.rol,
            nombre_completo: u.nombre_completo,
            especialidad: u.especialidad,
            cedula: u.cedula
          };
        }
        return {
          id: u.id,
          rol: u.rol,
          nombre_completo: u.nombre_completo,
          email: u.email,
          telefono: u.telefono,
          curp: u.curp
        };
      });

    return res.status(200).json({ usuarios });
  } catch (err) {
    console.error('Error en getUsuariosBatch:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

function getUsuarioPorId(req, res) {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'ID de usuario inválido.' });
  }

  try {
    const u = db.prepare(`
      SELECT id, rol, nombre_completo, email, telefono, curp, especialidad, cedula
      FROM usuarios
      WHERE id = ?
    `).get(targetId);

    if (!u) {
      return res.status(404).json({ error: 'Not Found', mensaje: 'Usuario no encontrado.' });
    }

    if (req.user.rol === 'paciente' && u.rol === 'paciente' && u.id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        mensaje: 'No tienes permiso para consultar el perfil de otro paciente.'
      });
    }

    const respuesta = u.rol === 'medico'
      ? {
          id: u.id,
          rol: u.rol,
          nombre_completo: u.nombre_completo,
          especialidad: u.especialidad,
          cedula: u.cedula
        }
      : {
          id: u.id,
          rol: u.rol,
          nombre_completo: u.nombre_completo,
          email: u.email,
          telefono: u.telefono,
          curp: u.curp
        };

    return res.status(200).json({ usuario: respuesta });
  } catch (err) {
    console.error('Error en getUsuarioPorId:', err);
    return res.status(500).json({ error: 'Internal Server Error', mensaje: err.message });
  }
}

module.exports = {
  getPerfil,
  getMedicos,
  getPacientes,
  getUsuariosBatch,
  getUsuarioPorId
};