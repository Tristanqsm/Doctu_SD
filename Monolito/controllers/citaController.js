const db = require('../database/db');

// Renderizar formulario para agendar cita
function getNuevaCita(req, res) {
  const user = req.session.user;

  try {
    const medicos = db.prepare(`
      SELECT id, nombre_completo, especialidad
      FROM usuarios
      WHERE rol = 'medico'
      ORDER BY nombre_completo ASC
    `).all();

    const pacientes = db.prepare(`
      SELECT id, nombre_completo, curp
      FROM usuarios
      WHERE rol = 'paciente'
      ORDER BY nombre_completo ASC
    `).all();

    const pacientePreseleccionado = req.query.pacienteId || null;

    res.render('nueva-cita', {
      title: 'Agendar Cita - Doctu',
      user,
      medicos,
      pacientes,
      pacientePreseleccionado,
      error: null,
      success: null
    });
  } catch (err) {
    console.error('Error en getNuevaCita:', err);
    res.status(500).render('error', {
      title: 'Error',
      mensaje: 'Error al cargar formulario de cita: ' + err.message,
      user
    });
  }
}

// Procesar guardado de cita
function postNuevaCita(req, res) {
  const user = req.session.user;
  let { id_paciente, id_medico, fecha, hora, motivo } = req.body;

  // Si el que agenda es el paciente, su id_paciente es el de su sesión
  if (user.rol === 'paciente') {
    id_paciente = user.id;
  }
  // Si el que agenda es el médico, su id_medico es el de su sesión
  if (user.rol === 'medico' && !id_medico) {
    id_medico = user.id;
  }

  if (!id_paciente || !id_medico || !fecha || !hora || !motivo) {
    return res.redirect('/citas/nueva?error=Todos los campos son obligatorios');
  }

  try {
    const insert = db.prepare(`
      INSERT INTO citas (id_paciente, id_medico, fecha, hora, motivo, estado)
      VALUES (?, ?, ?, ?, ?, 'Confirmada')
    `);

    insert.run(id_paciente, id_medico, fecha, hora, motivo.trim());

    console.log(`[Monolito] Nueva cita registrada para el ${fecha} a las ${hora}`);

    if (user.rol === 'medico') {
      res.redirect('/dashboard-medico?success=Cita agendada correctamente');
    } else {
      res.redirect('/portal-paciente?success=Tu cita ha sido agendada con éxito');
    }
  } catch (err) {
    console.error('Error en postNuevaCita:', err);
    res.redirect('/citas/nueva?error=' + encodeURIComponent(err.message));
  }
}

// Actualizar estado de cita (ej. Cancelar, Confirmar, Atender)
function updateEstadoCita(req, res) {
  const citaId = req.params.id;
  const { estado } = req.body;
  const user = req.session.user;

  const estadosValidos = ['Pendiente', 'Confirmada', 'Atendida', 'Cancelada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).send('Estado inválido');
  }

  try {
    db.prepare(`
      UPDATE citas
      SET estado = ?
      WHERE id = ?
    `).run(estado, citaId);

    console.log(`[Monolito] Cita #${citaId} actualizada a estado: ${estado}`);

    if (user.rol === 'medico') {
      res.redirect('/dashboard-medico?success=Estado de cita actualizado');
    } else {
      res.redirect('/portal-paciente?success=Cita actualizada');
    }
  } catch (err) {
    console.error('Error en updateEstadoCita:', err);
    res.redirect('/?error=' + encodeURIComponent(err.message));
  }
}

module.exports = {
  getNuevaCita,
  postNuevaCita,
  updateEstadoCita
};

