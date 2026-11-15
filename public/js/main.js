document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.createElement('div');
  canvas.className = 'liquid-canvas';
  canvas.innerHTML = `
    <div class="liquid-orb orb-1"></div>
    <div class="liquid-orb orb-2"></div>
    <div class="liquid-orb orb-3"></div>
  `;
  document.body.insertBefore(canvas, document.body.firstChild);

  document.querySelectorAll('.card, .glass-feature-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });

  let alertContainer = document.querySelector('.alert-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.className = 'alert-container';
    document.body.appendChild(alertContainer);
  }

  function showDynamicIsland(text, type = 'alert-info', icon = '✓') {
    const el = document.createElement('div');
    el.className = `alert ${type}`;
    el.innerHTML = `<span class="alert-icon">${icon}</span><span>${text}</span>`;
    alertContainer.appendChild(el);

    el.addEventListener('click', () => hideDynamicIsland(el));
    setTimeout(() => hideDynamicIsland(el), 3800);
  }

  function hideDynamicIsland(el) {
    if (!el || !el.parentNode) return;
    el.style.transition = 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-25px) scale(0.88)';
    setTimeout(() => el.remove(), 350);
  }

 
  document.querySelectorAll('main .alert').forEach(serverAlert => {
    const text = serverAlert.textContent.replace('⚠️', '').trim();
    const isDanger = serverAlert.classList.contains('alert-danger');
    serverAlert.remove();
    if (text) {
      showDynamicIsland(text, isDanger ? 'alert-danger' : 'alert-success', isDanger ? '!' : '✓');
    }
  });

  
  const params = new URLSearchParams(window.location.search);
  if (params.get('msg')) {
    showDynamicIsland(params.get('msg'), 'alert-info', '✓');
    window.history.replaceState({}, document.title, window.location.pathname);
  }


  window.cambiarRolRegistro = function(rol) {
    const camposMedico = document.getElementById('campos-medico');
    const camposPaciente = document.getElementById('campos-paciente');
    if (!camposMedico || !camposPaciente) return;

    if (rol === 'medico') {
      camposPaciente.style.display = 'none';
      camposMedico.style.display = 'block';
    } else {
      camposMedico.style.display = 'none';
      camposPaciente.style.display = 'block';
    }
  };
});