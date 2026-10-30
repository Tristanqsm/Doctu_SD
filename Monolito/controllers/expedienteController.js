const db = require('../database/db');

// Formulario de nuevo expediente
function getNuevoExpediente(req, res) {
  const user = req.session.user;
  const pacienteId = req.query.pacienteId || null;
  const citaId = req.query.citaId || null;

  try {
    const pacientes = db.prepare(`
      SELECT id, nombre_completo, curp, telefono
      FROM usuarios
      WHERE rol = 'paciente'
      ORDER BY nombre_completo ASC
    `).all();

    let pacienteSeleccionado = null;
    if (pacienteId) {
      pacienteSeleccionado = db.prepare('SELECT id, nombre_completo, curp, telefono FROM usuarios WHERE id = ?').get(pacienteId);
    }

    let citaSeleccionada = null;
    if (citaId) {
      citaSeleccionada = db.prepare('SELECT id, motivo, fecha, hora FROM citas WHERE id = ?').get(citaId);
    }

    const hoy = new Date().toISOString().split('T')[0];

    res.render('nuevo-expediente', {
      title: 'Crear Expediente Clínico - Doctu',
      user,
      pacientes,
      pacienteSeleccionado,
      citaSeleccionada,
      hoy,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error en getNuevoExpediente:', err);
    res.status(500).render('error', {
      title: 'Error',
      mensaje: 'Error al abrir formulario de expediente: ' + err.message,
      user
    });
  }
}

// Guardar nuevo expediente
function postNuevoExpediente(req, res) {
  const user = req.session.user;
  const {
    id_paciente,
    id_cita,
    fecha,
    motivo_consulta,
    peso_kg,
    talla_cm,
    temperatura_c,
    presion_arterial,
    diagnostico,
    tratamiento_receta,
    notas
  } = req.body;

  if (!id_paciente || !motivo_consulta || !diagnostico || !tratamiento_receta) {
    return res.redirect('/expedientes/nuevo?error=Paciente, motivo, diagnóstico y tratamiento son obligatorios');
  }

  try {
    const insert = db.prepare(`
      INSERT INTO expedientes (
        id_paciente, id_medico, id_cita, fecha,
        motivo_consulta, peso_kg, talla_cm, temperatura_c, presion_arterial,
        diagnostico, tratamiento_receta, notas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      id_paciente,
      user.id,
      id_cita ? parseInt(id_cita) : null,
      fecha || new Date().toISOString().split('T')[0],
      motivo_consulta.trim(),
      peso_kg ? parseFloat(peso_kg) : null,
      talla_cm ? parseFloat(talla_cm) : null,
      temperatura_c ? parseFloat(temperatura_c) : null,
      presion_arterial ? presion_arterial.trim() : null,
      diagnostico.trim(),
      tratamiento_receta.trim(),
      notas ? notas.trim() : null
    );

    // Si estaba ligado a una cita, marcamos la cita como Atendida
    if (id_cita) {
      db.prepare(`UPDATE citas SET estado = 'Atendida' WHERE id = ?`).run(id_cita);
    }

    console.log(`[Monolito] Nuevo expediente creado con ID #${result.lastInsertRowid}`);
    res.redirect(`/expedientes/${result.lastInsertRowid}?success=Expediente registrado exitosamente`);
  } catch (err) {
    console.error('Error en postNuevoExpediente:', err);
    res.redirect('/expedientes/nuevo?error=' + encodeURIComponent(err.message));
  }
}

// Ver expediente clínico individual (imprimible)
function getVerExpediente(req, res) {
  const expedienteId = req.params.id;
  const user = req.session.user;

  try {
    const expediente = db.prepare(`
      SELECT e.*,
             p.nombre_completo as paciente_nombre, p.curp as paciente_curp, p.telefono as paciente_telefono, p.email as paciente_email,
             m.nombre_completo as medico_nombre, m.especialidad as medico_especialidad, m.cedula as medico_cedula
      FROM expedientes e
      JOIN usuarios p ON e.id_paciente = p.id
      JOIN usuarios m ON e.id_medico = m.id
      WHERE e.id = ?
    `).get(expedienteId);

    if (!expediente) {
      return res.status(404).render('error', {
        title: 'Expediente no encontrado',
        mensaje: 'No se encontró el expediente solicitado.',
        user
      });
    }

    // Permisos: Paciente solo puede ver sus propios expedientes
    if (user.rol === 'paciente' && expediente.id_paciente !== user.id) {
      return res.status(403).render('error', {
        title: 'Acceso Denegado',
        mensaje: 'No tienes permiso para consultar este expediente.',
        user
      });
    }

    res.render('ver-expediente', {
      title: `Expediente #${expediente.id} - Doctu`,
      user,
      expediente,
      success: req.query.success || null
    });
  } catch (err) {
    console.error('Error en getVerExpediente:', err);
    res.status(500).render('error', {
      title: 'Error',
      mensaje: 'Error al recuperar expediente: ' + err.message,
      user
    });
  }
}

// Historial completo de un paciente específico (para el médico)
function getHistorialPaciente(req, res) {
  const pacienteId = req.params.id;
  const user = req.session.user;

  try {
    const paciente = db.prepare('SELECT * FROM usuarios WHERE id = ? AND rol = "paciente"').get(pacienteId);

    if (!paciente) {
      return res.status(404).render('error', {
        title: 'Paciente no encontrado',
        mensaje: 'El paciente solicitado no existe.',
        user
      });
    }

    const expedientes = db.prepare(`
      SELECT e.*,
             m.nombre_completo as medico_nombre, m.especialidad as medico_especialidad
      FROM expedientes e
      JOIN usuarios m ON e.id_medico = m.id
      WHERE e.id_paciente = ?
      ORDER BY e.fecha DESC, e.id DESC
    `).all(pacienteId);

    res.render('historial-paciente', {
      title: `Historial de ${paciente.nombre_completo} - Doctu`,
      user,
      paciente,
      expedientes
    });
  } catch (err) {
    console.error('Error en getHistorialPaciente:', err);
    res.status(500).render('error', {
      title: 'Error',
      mensaje: 'Error al consultar historial: ' + err.message,
      user
    });
  }
}

module.exports = {
  getNuevoExpediente,
  postNuevoExpediente,
  getVerExpediente,
  getHistorialPaciente
};

