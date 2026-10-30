// Doctu Monolito - Helper JS
document.addEventListener('DOMContentLoaded', () => {
  // Llenador rápido de credenciales de prueba en login
  window.llenarDemo = function(tipo) {
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const rolMedico = document.getElementById('rol-medico');
    const rolPaciente = document.getElementById('rol-paciente');

    if (tipo === 'medico') {
      if (emailInput) emailInput.value = 'doctor@doctu.com';
      if (passInput) passInput.value = 'password123';
      if (rolMedico) rolMedico.checked = true;
    } else if (tipo === 'paciente') {
      if (emailInput) emailInput.value = 'paciente@doctu.com';
      if (passInput) passInput.value = 'password123';
      if (rolPaciente) rolPaciente.checked = true;
    }
  };

  // Toggle de campos en registro según rol
  window.cambiarRolRegistro = function(rol) {
    const camposMedico = document.getElementById('campos-medico');
    const camposPaciente = document.getElementById('campos-paciente');

    if (rol === 'medico') {
      if (camposMedico) camposMedico.style.display = 'block';
      if (camposPaciente) camposPaciente.style.display = 'none';
    } else {
      if (camposMedico) camposMedico.style.display = 'none';
      if (camposPaciente) camposPaciente.style.display = 'block';
    }
  };
});

