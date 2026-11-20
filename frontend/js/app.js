const GATEWAY_URL = 'http://localhost:8080/api';
const TOKEN_KEY = 'doctu_token';
const USER_KEY = 'doctu_user';

const navbarRoot = document.getElementById('navbar-root');
const appRoot = document.getElementById('app');

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getPanelRoute(user) {
  if (!user) return '#/login';
  return user.rol === 'medico' ? '#/dashboard-medico' : '#/portal-paciente';
}

function saveSession(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (ch) {
    if (ch === '&') return '&';
    if (ch === '<') return '<';
    if (ch === '>') return '>';
    if (ch === '"') return '"';
    return '';
  });
}

function showToast(text, type) {
  const toastType = type || 'alert-info';
  let container = document.querySelector('.alert-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'alert-container';
    document.body.appendChild(container);
  }

  const icon = toastType === 'alert-danger' ? '!' : '✓';
  const el = document.createElement('div');
  el.className = 'alert ' + toastType;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'alert-icon';
  iconSpan.textContent = icon;

  const textSpan = document.createElement('span');
  textSpan.textContent = text;

  el.appendChild(iconSpan);
  el.appendChild(textSpan);
  container.appendChild(el);

  const hide = function () {
    if (!el.parentNode) return;
    el.style.transition = 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-25px) scale(0.88)';
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 350);
  };

  el.addEventListener('click', hide);
  setTimeout(hide, 3800);
}

function initLiquidCanvas() {
  if (document.querySelector('.liquid-canvas')) return;
  const canvas = document.createElement('div');
  canvas.className = 'liquid-canvas';
  canvas.innerHTML =
    '<div class="liquid-orb orb-1"></div>' +
    '<div class="liquid-orb orb-2"></div>' +
    '<div class="liquid-orb orb-3"></div>';
  document.body.insertBefore(canvas, document.body.firstChild);
}

function bindCardGlow() {
  document.querySelectorAll('.card, .glass-feature-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', e.clientX - rect.left + 'px');
      card.style.setProperty('--mouse-y', e.clientY - rect.top + 'px');
    });
  });
}

async function request(path, options) {
  const opts = options || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const token = getToken();
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  let response;
  try {
    response = await fetch(GATEWAY_URL + path, Object.assign({}, opts, { headers: headers }));
  } catch (e) {
    throw new Error('No se pudo conectar con el API Gateway (puerto 8080).');
  }

  const data = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession();
      window.location.hash = '#/login';
    }
    throw new Error(data.mensaje || data.error || 'Error HTTP ' + response.status);
  }

  return data;
}

const api = {
  login: function (payload) {
    return request('/usuarios/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  registro: function (payload) {
    return request('/usuarios/registro', { method: 'POST', body: JSON.stringify(payload) });
  },
  logout: function () {
    return request('/usuarios/logout', { method: 'POST' });
  },
  getPerfil: function () {
    return request('/usuarios/perfil');
  },
  getMedicos: function () {
    return request('/usuarios/medicos');
  },
  getPacientes: function (q) {
    const query = q ? '?q=' + encodeURIComponent(q) : '';
    return request('/usuarios/pacientes' + query);
  },
  getUsuariosBatch: function (ids) {
    return request('/usuarios/batch?ids=' + ids.join(','));
  },
  getUsuarioPorId: function (id) {
    return request('/usuarios/' + id);
  },
  getCitas: function () {
    return request('/agenda/citas');
  },
  getCitaPorId: function (id) {
    return request('/agenda/citas/' + id);
  },
  crearCita: function (payload) {
    return request('/agenda/citas', { method: 'POST', body: JSON.stringify(payload) });
  },
  actualizarEstadoCita: function (id, estado) {
    return request('/agenda/citas/' + id + '/estado', {
      method: 'POST',
      body: JSON.stringify({ estado: estado })
    });
  },
  getExpedientes: function () {
    return request('/expedientes/expedientes');
  },
  getHistorialPaciente: function (id) {
    return request('/expedientes/expedientes/paciente/' + id);
  },
  getExpedientePorId: function (id) {
    return request('/expedientes/expedientes/' + id);
  },
  crearExpediente: function (payload) {
    return request('/expedientes/expedientes', { method: 'POST', body: JSON.stringify(payload) });
  }
};

function getRoute() {
  const hash = window.location.hash || '#/';
  const parts = hash.slice(1).split('?');
  const path = parts[0] || '/';
  const params = new URLSearchParams(parts[1] || '');
  return { path: path, params: params };
}

function navigate(hashPath) {
  const target = hashPath.startsWith('#') ? hashPath : '#' + hashPath;
  if (window.location.hash === target) {
    render();
  } else {
    window.location.hash = target;
  }
}

function renderNavbar(currentPath) {
  const user = getUser();
  const brandHref = user ? getPanelRoute(user) : '#/';
  let navItems = '';

  if (!user) {
    navItems =
      '<li><a href="#/" class="nav-link ' + (currentPath === '/' ? 'active' : '') + '">Inicio</a></li>' +
      '<li><a href="#/login" class="nav-link ' + (currentPath === '/login' ? 'active' : '') + '">Iniciar Sesión</a></li>' +
      '<li><a href="#/registro" class="btn btn-primary btn-sm">Crear Cuenta</a></li>';
  } else if (user.rol === 'medico') {
    const nombreLimpio = (user.nombre || 'Médico').replace(/^Dra?\.\s*/i, '').split(' ')[0];
    navItems =
      '<li><a href="#/dashboard-medico" class="nav-link ' + (currentPath === '/dashboard-medico' ? 'active' : '') + '">Agenda</a></li>' +
      '<li><a href="#/citas/nueva" class="nav-link ' + (currentPath === '/citas/nueva' ? 'active' : '') + '">Agendar Cita</a></li>' +
      '<li><a href="#/expedientes/nuevo" class="nav-link ' + (currentPath === '/expedientes/nuevo' ? 'active' : '') + '">Nueva Consulta</a></li>' +
      '<li class="nav-divider"></li>' +
      '<li><span class="user-badge">Dr. ' + escapeHtml(nombreLimpio) + '</span></li>' +
      '<li><button type="button" id="btn-logout" class="nav-link" style="color: var(--danger); background: transparent; border: none; cursor: pointer;">Salir</button></li>';
  } else {
    const primerNombre = (user.nombre || 'Paciente').split(' ')[0];
    navItems =
      '<li><a href="#/portal-paciente" class="nav-link ' + (currentPath === '/portal-paciente' ? 'active' : '') + '">Mi Portal</a></li>' +
      '<li><a href="#/citas/nueva" class="nav-link ' + (currentPath === '/citas/nueva' ? 'active' : '') + '">Agendar Cita</a></li>' +
      '<li class="nav-divider"></li>' +
      '<li><span class="user-badge">' + escapeHtml(primerNombre) + '</span></li>' +
      '<li><button type="button" id="btn-logout" class="nav-link" style="color: var(--danger); background: transparent; border: none; cursor: pointer;">Salir</button></li>';
  }

  navbarRoot.innerHTML =
    '<nav class="navbar">' +
      '<a href="' + brandHref + '" class="navbar-brand">' +
        '<span class="brand-mark">D</span>' +
        '<span>DOCTU</span>' +
      '</a>' +
      '<ul class="navbar-nav">' + navItems + '</ul>' +
    '</nav>';

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      try {
        await api.logout();
      } catch (e) {}
      clearSession();
      showToast('Sesión cerrada correctamente.', 'alert-info');
      navigate('#/login');
    });
  }
}

function renderErrorView(title, mensaje) {
  const user = getUser();
  const panelHref = user ? getPanelRoute(user) : null;

  appRoot.innerHTML =
    '<div class="container-narrow" style="text-align: center; margin: 3rem auto;">' +
      '<div class="card" style="padding: 2.5rem 1.5rem;">' +
        '<h1 style="color: var(--danger); font-size: 2.5rem; margin-bottom: 0.5rem;">⚠️</h1>' +
        '<h2 style="color: var(--primary); margin-bottom: 0.5rem;">' + escapeHtml(title) + '</h2>' +
        '<p style="color: var(--text-muted); margin-bottom: 1.5rem;">' + escapeHtml(mensaje) + '</p>' +
        '<div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">' +
          '<a href="' + (panelHref || '#/') + '" class="btn btn-primary">' + (panelHref ? 'Volver a Mi Panel' : 'Ir al Inicio') + '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderInicio() {
  const user = getUser();
  if (user) {
    navigate(getPanelRoute(user));
    return;
  }

  appRoot.innerHTML =
    '<section style="width: 100vw; margin-left: calc(50% - 50vw); min-height: calc(100vh - 150px); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2rem 1.5rem;">' +
      '<h1 class="kinetic-gradient" style="font-size: clamp(5rem, 22vw, 18rem); font-weight: 800; line-height: 0.92; letter-spacing: -0.06em; margin-bottom: 2.5rem; user-select: none;">DOCTU</h1>' +
      '<div style="display: inline-flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">' +
        '<a href="#/login" class="btn btn-primary" style="padding: 0.85rem 2.2rem; font-size: 1rem;">Iniciar Sesión</a>' +
        '<a href="#/registro" class="btn btn-outline" style="padding: 0.85rem 2.2rem; font-size: 1rem;">Crear Cuenta</a>' +
      '</div>' +
    '</section>';
}

function renderLogin(params) {
  const user = getUser();
  if (user) {
    navigate(getPanelRoute(user));
    return;
  }

  const rolDefecto = params.get('rol') === 'medico' ? 'medico' : 'paciente';

  appRoot.innerHTML =
    '<div class="container-narrow">' +
      '<div class="card" style="margin-bottom: 0; padding: 2.1rem;">' +
        '<div style="text-align: center; margin-bottom: 1.4rem;">' +
          '<h2 style="font-size: 1.45rem; font-weight: 800; letter-spacing: -0.03em; color: var(--ink);">Iniciar Sesión</h2>' +
          '<p style="font-size: 0.86rem; color: var(--text-muted); margin-top: 4px;">Accede a tu cuenta de Doctu</p>' +
        '</div>' +
        '<form id="form-login" autocomplete="on">' +
          '<div class="form-group">' +
            '<label class="form-label">Tipo de cuenta</label>' +
            '<div class="segmented-control">' +
              '<label class="segmented-option">' +
                '<input type="radio" name="rol" value="paciente" ' + (rolDefecto === 'paciente' ? 'checked' : '') + '>' +
                '<span>Paciente</span>' +
              '</label>' +
              '<label class="segmented-option">' +
                '<input type="radio" name="rol" value="medico" ' + (rolDefecto === 'medico' ? 'checked' : '') + '>' +
                '<span>Médico</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="email" class="form-label">Correo Electrónico</label>' +
            '<input type="email" id="email" name="email" class="form-control" placeholder="nombre@ejemplo.com" autocomplete="username" required>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="password" class="form-label">Contraseña</label>' +
            '<input type="password" id="password" name="password" class="form-control" placeholder="••••••••" autocomplete="current-password" required>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.72rem; margin-top: 0.3rem;">Continuar</button>' +
        '</form>' +
        '<p style="text-align: center; margin-top: 1.25rem; font-size: 0.84rem; color: var(--text-muted);">' +
          '¿No tienes una cuenta? <a href="#/registro" style="color: var(--primary); font-weight: 700; text-decoration: none;">Crear cuenta</a>' +
        '</p>' +
      '</div>' +
    '</div>';

  document.getElementById('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    const form = e.target;
    try {
      const data = await api.login({
        rol: form.rol.value,
        email: form.email.value.trim(),
        password: form.password.value
      });
      saveSession(data.token, data.usuario);
      showToast('Bienvenido, ' + data.usuario.nombre, 'alert-success');
      navigate(data.usuario.rol === 'medico' ? '#/dashboard-medico' : '#/portal-paciente');
    } catch (err) {
      showToast(err.message, 'alert-danger');
    }
  });
}

function renderRegistro(params) {
  const user = getUser();
  if (user) {
    navigate(getPanelRoute(user));
    return;
  }

  const rolDefecto = params.get('rol') === 'medico' ? 'medico' : 'paciente';

  appRoot.innerHTML =
    '<div class="container-narrow" style="margin: 2rem auto;">' +
      '<div class="card">' +
        '<div class="card-header"><div class="card-title">Crear Cuenta Nueva</div></div>' +
        '<form id="form-registro">' +
          '<div class="form-group">' +
            '<label class="form-label">Registrarme como:</label>' +
            '<div style="display: flex; gap: 1rem; margin-top: 0.25rem;">' +
              '<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">' +
                '<input type="radio" name="rol" value="paciente" ' + (rolDefecto === 'paciente' ? 'checked' : '') + '> Paciente' +
              '</label>' +
              '<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">' +
                '<input type="radio" name="rol" value="medico" ' + (rolDefecto === 'medico' ? 'checked' : '') + '> Médico' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="nombreCompleto" class="form-label">Nombre Completo:</label>' +
            '<input type="text" id="nombreCompleto" name="nombreCompleto" class="form-control" placeholder="Ej. Juan Pérez" required>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="email" class="form-label">Correo Electrónico:</label>' +
              '<input type="email" id="email" name="email" class="form-control" placeholder="correo@ejemplo.com" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="telefono" class="form-label">Teléfono:</label>' +
              '<input type="tel" id="telefono" name="telefono" class="form-control" placeholder="5512345678">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="password" class="form-label">Contraseña:</label>' +
            '<input type="password" id="password" name="password" class="form-control" placeholder="••••••••" required>' +
          '</div>' +
          '<div id="campos-paciente" style="display: ' + (rolDefecto === 'paciente' ? 'block' : 'none') + ';">' +
            '<div class="form-group">' +
              '<label for="curp" class="form-label">CURP (opcional):</label>' +
              '<input type="text" id="curp" name="curp" class="form-control" placeholder="18 caracteres alfanuméricos">' +
            '</div>' +
          '</div>' +
          '<div id="campos-medico" style="display: ' + (rolDefecto === 'medico' ? 'block' : 'none') + ';">' +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label for="especialidad" class="form-label">Especialidad:</label>' +
                '<input type="text" id="especialidad" name="especialidad" class="form-control" placeholder="Ej. Medicina General">' +
              '</div>' +
              '<div class="form-group">' +
                '<label for="cedula" class="form-label">Cédula Profesional:</label>' +
                '<input type="text" id="cedula" name="cedula" class="form-control" placeholder="Ej. MED-123456">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Completar Registro</button>' +
        '</form>' +
        '<p style="text-align: center; margin-top: 1.25rem; font-size: 0.88rem; color: var(--text-muted);">' +
          '¿Ya tienes cuenta? <a href="#/login" style="color: var(--primary); font-weight: 600;">Inicia sesión</a>' +
        '</p>' +
      '</div>' +
    '</div>';

  const form = document.getElementById('form-registro');
  const camposPaciente = document.getElementById('campos-paciente');
  const camposMedico = document.getElementById('campos-medico');

  form.querySelectorAll('input[name="rol"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (form.rol.value === 'medico') {
        camposPaciente.style.display = 'none';
        camposMedico.style.display = 'block';
      } else {
        camposPaciente.style.display = 'block';
        camposMedico.style.display = 'none';
      }
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const payload = {
      rol: form.rol.value,
      nombreCompleto: form.nombreCompleto.value.trim(),
      email: form.email.value.trim(),
      telefono: form.telefono.value.trim() || null,
      password: form.password.value,
      curp: form.rol.value === 'paciente' ? form.curp.value.trim() || null : null,
      especialidad: form.rol.value === 'medico' ? form.especialidad.value.trim() || 'Medicina General' : null,
      cedula: form.rol.value === 'medico' ? form.cedula.value.trim() || null : null
    };

    try {
      await api.registro(payload);
      showToast('Cuenta creada exitosamente. Ahora inicia sesión.', 'alert-success');
      navigate('#/login?rol=' + encodeURIComponent(payload.rol));
    } catch (err) {
      showToast(err.message, 'alert-danger');
    }
  });
}

async function renderDashboardMedico(params) {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'medico') return renderErrorView('Acceso Denegado', 'Esta sección es exclusiva para personal médico.');

  const busqueda = (params.get('q') || '').trim();
  appRoot.innerHTML = '<div class="card"><p style="color: var(--text-muted); text-align: center;">Cargando panel médico...</p></div>';

  try {
    const results = await Promise.all([
      api.getPerfil(),
      api.getCitas(),
      api.getExpedientes(),
      api.getPacientes(busqueda)
    ]);

    const perfil = results[0].usuario || user;
    const citasRes = results[1];
    const expedientesRes = results[2];
    const pacientes = results[3].pacientes || [];

    const hoy = citasRes.hoy || new Date().toISOString().split('T')[0];
    const citas = citasRes.citas || [];
    const totalCitasHoy = (citasRes.resumen && citasRes.resumen.totalCitasHoy) || 0;
    const citasPendientes = (citasRes.resumen && citasRes.resumen.citasPendientes) || 0;
    const totalExpedientes =
      typeof expedientesRes.total === 'number' ? expedientesRes.total : (expedientesRes.expedientes || []).length;

    const idsPacientes = Array.from(
      new Set(
        citas
          .map(function (c) {
            return c.id_paciente;
          })
          .filter(Boolean)
      )
    );
    const mapaPacientes = new Map();
    if (idsPacientes.length > 0) {
      const batchRes = await api.getUsuariosBatch(idsPacientes);
      (batchRes.usuarios || []).forEach(function (u) {
        mapaPacientes.set(u.id, u);
      });
    }

    const nombreBase = perfil.nombre || user.nombre || 'Médico';
    const tituloMedico = nombreBase.startsWith('Dr') ? nombreBase : 'Dr. ' + nombreBase;

    const filasCitas = citas
      .map(function (c) {
        const pac = mapaPacientes.get(c.id_paciente) || {};
        const badgeClass = 'badge-' + String(c.estado || '').toLowerCase();
        const puedeAtender = c.estado === 'Pendiente' || c.estado === 'Confirmada';
        const puedeConfirmar = c.estado === 'Pendiente';
        const puedeCancelar = c.estado !== 'Cancelada' && c.estado !== 'Atendida';

        return (
          '<tr class="' +
          (c.fecha === hoy ? 'cita-hoy' : '') +
          '">' +
          '<td style="white-space: nowrap;">' +
          '<strong style="color: var(--ink);">' +
          escapeHtml(c.fecha) +
          '</strong><br>' +
          '<span class="mono" style="font-size: 0.72rem;">' +
          escapeHtml(c.hora) +
          ' hrs</span>' +
          '</td>' +
          '<td><strong style="color: var(--ink);">' +
          escapeHtml(pac.nombre_completo || 'Paciente #' + c.id_paciente) +
          '</strong></td>' +
          '<td style="white-space: nowrap;">' +
          '<code>' +
          escapeHtml(pac.curp || 'Sin CURP') +
          '</code><br>' +
          '<span style="font-size: 0.76rem; color: var(--text-muted);">' +
          escapeHtml(pac.telefono || 'Sin Tel') +
          '</span>' +
          '</td>' +
          '<td>' +
          escapeHtml(c.motivo) +
          '</td>' +
          '<td><span class="badge ' +
          badgeClass +
          '">' +
          escapeHtml(c.estado) +
          '</span></td>' +
          '<td style="text-align: right; white-space: nowrap;">' +
          '<div class="btn-group">' +
          (puedeAtender
            ? '<a href="#/expedientes/nuevo?citaId=' +
              c.id +
              '&pacienteId=' +
              c.id_paciente +
              '" class="btn btn-sm btn-primary">Atender</a>'
            : '') +
          (puedeConfirmar
            ? '<button type="button" class="btn btn-sm btn-outline btn-estado-cita" data-id="' +
              c.id +
              '" data-estado="Confirmada">Confirmar</button>'
            : '') +
          (puedeCancelar
            ? '<button type="button" class="btn btn-sm btn-ghost-danger btn-estado-cita" data-id="' +
              c.id +
              '" data-estado="Cancelada" title="Cancelar cita">✕</button>'
            : '') +
          '</div>' +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    const filasPacientes = pacientes
      .map(function (p) {
        return (
          '<tr>' +
          '<td><strong style="color: var(--ink);">' +
          escapeHtml(p.nombre_completo) +
          '</strong></td>' +
          '<td><code>' +
          escapeHtml(p.curp || 'No registrado') +
          '</code></td>' +
          '<td>' +
          escapeHtml(p.email) +
          '</td>' +
          '<td class="mono">' +
          escapeHtml(p.telefono || 'Sin teléfono') +
          '</td>' +
          '<td style="text-align: right; white-space: nowrap;">' +
          '<div class="btn-group">' +
          '<a href="#/expedientes/paciente/' +
          p.id +
          '" class="btn btn-sm btn-outline">Ver Historial</a>' +
          '<a href="#/expedientes/nuevo?pacienteId=' +
          p.id +
          '" class="btn btn-sm btn-primary">＋ Consulta</a>' +
          '</div>' +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    appRoot.innerHTML =
      '<div class="page-header">' +
      '<div>' +
      '<h2 class="page-title">' +
      escapeHtml(tituloMedico) +
      '</h2>' +
      '<div class="page-meta">' +
      '<span>' +
      escapeHtml(perfil.especialidad || 'Medicina General') +
      '</span>' +
      '<span>·</span>' +
      '<span class="mono">Cédula ' +
      escapeHtml(perfil.cedula || 'En trámite') +
      '</span>' +
      '</div>' +
      '</div>' +
      '<span class="mono">Fecha: ' +
      escapeHtml(hoy) +
      '</span>' +
      '</div>' +
      '<div class="grid-3">' +
      '<div class="stat-card">' +
      '<div class="stat-icon" style="background: var(--primary-soft); color: var(--primary);">🗓️</div>' +
      '<div class="stat-info"><div class="stat-num">' +
      totalCitasHoy +
      '</div><div class="stat-label">Citas para Hoy</div></div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-icon" style="background: var(--warning-soft); color: var(--warning);">⏳</div>' +
      '<div class="stat-info"><div class="stat-num">' +
      citasPendientes +
      '</div><div class="stat-label">Por Atender</div></div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-icon" style="background: var(--success-soft); color: var(--success);">📋</div>' +
      '<div class="stat-info"><div class="stat-num">' +
      totalExpedientes +
      '</div><div class="stat-label">Expedientes</div></div>' +
      '</div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card-header">' +
      '<div class="card-title">Agenda de Consultas</div>' +
      '<a href="#/citas/nueva" class="btn btn-sm btn-outline">＋ Agendar Cita</a>' +
      '</div>' +
      (citas.length === 0
        ? '<p style="color: var(--text-muted); text-align: center; padding: 1.25rem;">No tienes citas programadas por el momento.</p>'
        : '<div class="table-responsive"><table class="table"><thead><tr><th>Fecha / Hora</th><th>Paciente</th><th>CURP / Contacto</th><th>Motivo de Consulta</th><th>Estado</th><th style="text-align: right;">Acciones</th></tr></thead><tbody>' +
          filasCitas +
          '</tbody></table></div>') +
      '</div>' +
      '<div class="card" style="margin-bottom: 0;">' +
      '<div class="card-header">' +
      '<div class="card-title">Directorio de Pacientes</div>' +
      '<form id="form-buscar-paciente" style="display: flex; gap: 0.45rem; align-items: center;">' +
      '<input type="text" name="q" value="' +
      escapeHtml(busqueda) +
      '" class="form-control" placeholder="Buscar paciente o CURP..." style="width: 240px; padding: 0.38rem 0.85rem; font-size: 0.82rem;">' +
      '<button type="submit" class="btn btn-sm btn-outline">Buscar</button>' +
      (busqueda ? '<a href="#/dashboard-medico" class="btn btn-sm btn-ghost-danger" title="Limpiar búsqueda">✕</a>' : '') +
      '</form>' +
      '</div>' +
      (pacientes.length === 0
        ? '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No se encontraron pacientes que coincidan con la búsqueda.</p>'
        : '<div class="table-responsive"><table class="table"><thead><tr><th>Paciente</th><th>CURP</th><th>Correo</th><th>Teléfono</th><th style="text-align: right;">Expediente</th></tr></thead><tbody>' +
          filasPacientes +
          '</tbody></table></div>') +
      '</div>';

    bindCardGlow();

    document.getElementById('form-buscar-paciente').addEventListener('submit', function (e) {
      e.preventDefault();
      const qVal = e.target.q.value.trim();
      navigate(qVal ? '#/dashboard-medico?q=' + encodeURIComponent(qVal) : '#/dashboard-medico');
    });

    document.querySelectorAll('.btn-estado-cita').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const citaId = btn.dataset.id;
        const estado = btn.dataset.estado;
        if (estado === 'Cancelada' && !confirm('¿Cancelar esta cita?')) return;
        try {
          await api.actualizarEstadoCita(citaId, estado);
          showToast('Cita #' + citaId + ' marcada como ' + estado + '.', 'alert-success');
          renderDashboardMedico(params);
        } catch (err) {
          showToast(err.message, 'alert-danger');
        }
      });
    });
  } catch (err) {
    renderErrorView('Error al cargar panel médico', err.message);
  }
}

async function renderPortalPaciente() {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'paciente') return renderErrorView('Acceso Denegado', 'Esta sección es exclusiva para pacientes.');

  appRoot.innerHTML = '<div class="card"><p style="color: var(--text-muted); text-align: center;">Cargando portal del paciente...</p></div>';

  try {
    const results = await Promise.all([api.getPerfil(), api.getCitas(), api.getExpedientes()]);
    const perfil = results[0].usuario || user;
    const citas = results[1].citas || [];
    const expedientes = results[2].expedientes || [];

    const idsMedicos = Array.from(
      new Set(
        citas
          .map(function (c) {
            return c.id_medico;
          })
          .concat(
            expedientes.map(function (e) {
              return e.id_medico;
            })
          )
          .filter(Boolean)
      )
    );

    const mapaMedicos = new Map();
    if (idsMedicos.length > 0) {
      const batchRes = await api.getUsuariosBatch(idsMedicos);
      (batchRes.usuarios || []).forEach(function (u) {
        mapaMedicos.set(u.id, u);
      });
    }

    const filasCitas = citas
      .map(function (c) {
        const med = mapaMedicos.get(c.id_medico) || {};
        const badgeClass = 'badge-' + String(c.estado || '').toLowerCase();
        const puedeCancelar = c.estado === 'Pendiente' || c.estado === 'Confirmada';

        return (
          '<tr>' +
          '<td><strong>' +
          escapeHtml(c.fecha) +
          '</strong></td>' +
          '<td>' +
          escapeHtml(c.hora) +
          ' hrs</td>' +
          '<td>' +
          escapeHtml(med.nombre_completo || 'Médico #' + c.id_medico) +
          '</td>' +
          '<td><span style="color: var(--text-muted);">' +
          escapeHtml(med.especialidad || 'Medicina General') +
          '</span></td>' +
          '<td>' +
          escapeHtml(c.motivo) +
          '</td>' +
          '<td><span class="badge ' +
          badgeClass +
          '">' +
          escapeHtml(c.estado) +
          '</span></td>' +
          '<td>' +
          (puedeCancelar
            ? '<button type="button" class="btn btn-sm btn-outline btn-cancelar-cita" data-id="' +
              c.id +
              '" style="color: var(--danger);">Cancelar</button>'
            : '<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    const tarjetasExpedientes = expedientes
      .map(function (e) {
        const med = mapaMedicos.get(e.id_medico) || {};
        return (
          '<div style="border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.25rem; background: rgba(255, 255, 255, 0.82);">' +
          '<div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--glass-border-subtle); padding-bottom: 0.75rem; margin-bottom: 0.75rem; gap: 0.5rem; flex-wrap: wrap;">' +
          '<div>' +
          '<h3 style="font-size: 1.05rem; color: var(--primary); margin-bottom: 2px;">Consulta Médica · ' +
          escapeHtml(e.fecha) +
          '</h3>' +
          '<p style="font-size: 0.85rem; color: var(--text-muted);">Atendido por: <strong>' +
          escapeHtml(med.nombre_completo || 'Médico #' + e.id_medico) +
          '</strong> (' +
          escapeHtml(med.especialidad || 'Medicina General') +
          ')</p>' +
          '</div>' +
          '<a href="#/expedientes/' +
          e.id +
          '" class="btn btn-sm btn-outline">📄 Ver Receta / Imprimir</a>' +
          '</div>' +
          '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 0.75rem;">' +
          '<div><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Diagnóstico:</span><p style="font-weight: 600; color: var(--ink);">' +
          escapeHtml(e.diagnostico) +
          '</p></div>' +
          '<div><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Motivo de consulta:</span><p style="color: var(--ink-secondary); font-size: 0.9rem;">' +
          escapeHtml(e.motivo_consulta) +
          '</p></div>' +
          '</div>' +
          '<div style="background: rgba(240, 245, 250, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.75rem 1rem;">' +
          '<span style="font-size: 0.78rem; text-transform: uppercase; color: var(--primary); font-weight: 700;">Tratamiento y Receta:</span>' +
          '<p style="margin-top: 4px; font-size: 0.92rem; color: var(--ink); white-space: pre-line;">' +
          escapeHtml(e.tratamiento_receta) +
          '</p>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    appRoot.innerHTML =
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">' +
      '<div>' +
      '<h2 style="color: var(--primary);">Hola, ' +
      escapeHtml(perfil.nombre || user.nombre) +
      '</h2>' +
      '<p style="color: var(--text-muted); font-size: 0.9rem;">CURP: ' +
      escapeHtml(perfil.curp || 'No registrada') +
      ' | Tel: ' +
      escapeHtml(perfil.telefono || 'No registrado') +
      ' | ' +
      escapeHtml(perfil.email || user.email) +
      '</p>' +
      '</div>' +
      '<div><a href="#/citas/nueva" class="btn btn-primary">➕ Solicitar / Agendar Cita</a></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">📅 Mis Citas Médicas</div></div>' +
      (citas.length === 0
        ? '<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No tienes citas programadas actualmente.</p>'
        : '<div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Hora</th><th>Médico Tratante</th><th>Especialidad</th><th>Motivo de Consulta</th><th>Estado</th><th>Acción</th></tr></thead><tbody>' +
          filasCitas +
          '</tbody></table></div>') +
      '</div>' +
      '<div class="card" style="margin-bottom: 0;">' +
      '<div class="card-header"><div class="card-title">📋 Mi Historial Clínico y Recetas</div></div>' +
      (expedientes.length === 0
        ? '<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">Aún no se han registrado expedientes o consultas médicas para tu cuenta.</p>'
        : '<div style="display: flex; flex-direction: column; gap: 1rem;">' + tarjetasExpedientes + '</div>') +
      '</div>';

    bindCardGlow();

    document.querySelectorAll('.btn-cancelar-cita').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('¿Deseas cancelar esta cita?')) return;
        try {
          await api.actualizarEstadoCita(btn.dataset.id, 'Cancelada');
          showToast('Cita cancelada.', 'alert-success');
          renderPortalPaciente();
        } catch (err) {
          showToast(err.message, 'alert-danger');
        }
      });
    });
  } catch (err) {
    renderErrorView('Error al cargar portal', err.message);
  }
}

async function renderNuevaCita(params) {
  const user = getUser();
  if (!user) return navigate('#/login');

  const pacientePreseleccionado = params.get('pacienteId') || '';
  appRoot.innerHTML = '<div class="card"><p style="color: var(--text-muted); text-align: center;">Cargando formulario de cita...</p></div>';

  try {
    let medicos = [];
    let pacientes = [];

    if (user.rol === 'medico') {
      const pacRes = await api.getPacientes('');
      pacientes = pacRes.pacientes || [];
    } else {
      const medRes = await api.getMedicos();
      medicos = medRes.medicos || [];
    }

    const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const hoy = new Date().toISOString().split('T')[0];
    const volverHref = getPanelRoute(user);

    const selectorHtml =
      user.rol === 'medico'
        ? '<div class="form-group"><label for="id_paciente" class="form-label">Seleccionar Paciente:</label><select name="id_paciente" id="id_paciente" class="form-control" required><option value="">-- Elige un paciente --</option>' +
          pacientes
            .map(function (p) {
              return (
                '<option value="' +
                p.id +
                '" ' +
                (String(pacientePreseleccionado) === String(p.id) ? 'selected' : '') +
                '>' +
                escapeHtml(p.nombre_completo) +
                (p.curp ? ' (' + escapeHtml(p.curp) + ')' : '') +
                '</option>'
              );
            })
            .join('') +
          '</select></div>'
        : '<div class="form-group"><label for="id_medico" class="form-label">Seleccionar Médico:</label><select name="id_medico" id="id_medico" class="form-control" required><option value="">-- Elige un médico --</option>' +
          medicos
            .map(function (m) {
              return (
                '<option value="' +
                m.id +
                '">' +
                escapeHtml(m.nombre_completo) +
                ' (' +
                escapeHtml(m.especialidad || 'Medicina General') +
                ')</option>'
              );
            })
            .join('') +
          '</select></div>';

    appRoot.innerHTML =
      '<div class="container-narrow" style="margin: 1.5rem auto;">' +
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">' +
      '<h2 style="color: var(--primary);">Agendar Nueva Cita</h2>' +
      '<a href="' +
      volverHref +
      '" class="btn btn-outline btn-sm">← Regresar</a>' +
      '</div>' +
      '<div class="card">' +
      '<form id="form-nueva-cita">' +
      selectorHtml +
      '<div class="form-row">' +
      '<div class="form-group"><label for="fecha" class="form-label">Fecha de la Cita:</label><input type="date" id="fecha" name="fecha" class="form-control" value="' +
      manana +
      '" min="' +
      hoy +
      '" required></div>' +
      '<div class="form-group"><label for="hora" class="form-label">Hora (ej. 10:30):</label><input type="time" id="hora" name="hora" class="form-control" value="10:00" required></div>' +
      '</div>' +
      '<div class="form-group"><label for="motivo" class="form-label">Motivo de la Cita:</label><textarea id="motivo" name="motivo" class="form-control" rows="3" placeholder="Describe brevemente la razón de la consulta..." required></textarea></div>' +
      '<button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">📅 Confirmar y Guardar Cita</button>' +
      '</form>' +
      '</div>' +
      '</div>';

    document.getElementById('form-nueva-cita').addEventListener('submit', async function (e) {
      e.preventDefault();
      const form = e.target;
      const payload = {
        fecha: form.fecha.value,
        hora: form.hora.value,
        motivo: form.motivo.value.trim()
      };
      if (user.rol === 'medico') {
        payload.id_medico = user.id;
        payload.id_paciente = Number(form.id_paciente.value);
      } else {
        payload.id_paciente = user.id;
        payload.id_medico = Number(form.id_medico.value);
      }

      try {
        await api.crearCita(payload);
        showToast('Cita agendada correctamente.', 'alert-success');
        navigate(volverHref);
      } catch (err) {
        showToast(err.message, 'alert-danger');
      }
    });
  } catch (err) {
    renderErrorView('Error al cargar formulario de cita', err.message);
  }
}

async function renderNuevoExpediente(params) {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'medico') return renderErrorView('Acceso Denegado', 'Esta sección es exclusiva para personal médico.');

  const pacienteIdParam = params.get('pacienteId') || '';
  const citaIdParam = params.get('citaId') || '';

  appRoot.innerHTML = '<div class="card"><p style="color: var(--text-muted); text-align: center;">Cargando formulario clínico...</p></div>';

  try {
    const results = await Promise.all([
      api.getPacientes(''),
      citaIdParam
        ? api.getCitaPorId(citaIdParam).catch(function () {
            return null;
          })
        : Promise.resolve(null)
    ]);

    const pacientes = results[0].pacientes || [];
    const citaSeleccionada = results[1] && results[1].cita ? results[1].cita : null;
    const pacienteSeleccionado =
      pacientes.find(function (p) {
        return String(p.id) === String(pacienteIdParam);
      }) || null;
    const hoy = new Date().toISOString().split('T')[0];

    const pacienteFieldHtml = pacienteSeleccionado
      ? '<input type="hidden" name="id_paciente" value="' +
        pacienteSeleccionado.id +
        '">' +
        '<input type="text" class="form-control" value="' +
        escapeHtml(pacienteSeleccionado.nombre_completo) +
        ' (CURP: ' +
        escapeHtml(pacienteSeleccionado.curp || 'N/A') +
        ')" readonly>'
      : '<select name="id_paciente" id="id_paciente" class="form-control" required><option value="">-- Selecciona un paciente --</option>' +
        pacientes
          .map(function (p) {
            return (
              '<option value="' +
              p.id +
              '" ' +
              (String(pacienteIdParam) === String(p.id) ? 'selected' : '') +
              '>' +
              escapeHtml(p.nombre_completo) +
              (p.curp ? ' (' + escapeHtml(p.curp) + ')' : '') +
              '</option>'
            );
          })
          .join('') +
        '</select>';

    appRoot.innerHTML =
      '<div style="max-width: 800px; margin: 1rem auto;">' +
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">' +
      '<h2 style="color: var(--primary);">Registrar Expediente Clínico</h2>' +
      '<a href="#/dashboard-medico" class="btn btn-outline btn-sm">← Volver al Panel</a>' +
      '</div>' +
      '<div class="card">' +
      '<form id="form-nuevo-expediente">' +
      (citaSeleccionada ? '<input type="hidden" name="id_cita" value="' + citaSeleccionada.id + '">' : '') +
      '<div class="form-row">' +
      '<div class="form-group" style="flex: 2;"><label for="id_paciente" class="form-label">Paciente:</label>' +
      pacienteFieldHtml +
      '</div>' +
      '<div class="form-group" style="flex: 1;"><label for="fecha" class="form-label">Fecha de Consulta:</label><input type="date" id="fecha" name="fecha" class="form-control" value="' +
      hoy +
      '" required></div>' +
      '</div>' +
      '<div style="background: rgba(255, 255, 255, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">' +
      '<label class="form-label" style="color: var(--primary); margin-bottom: 0.75rem;">🩺 Signos Vitales y Somatometría</label>' +
      '<div class="form-row">' +
      '<div class="form-group"><label for="presion_arterial" class="form-label" style="font-weight: normal; font-size: 0.82rem;">Presión Arterial (mmHg):</label><input type="text" id="presion_arterial" name="presion_arterial" class="form-control" placeholder="Ej. 120/80"></div>' +
      '<div class="form-group"><label for="temperatura_c" class="form-label" style="font-weight: normal; font-size: 0.82rem;">Temperatura (°C):</label><input type="number" step="0.1" id="temperatura_c" name="temperatura_c" class="form-control" placeholder="Ej. 36.5"></div>' +
      '<div class="form-group"><label for="peso_kg" class="form-label" style="font-weight: normal; font-size: 0.82rem;">Peso (kg):</label><input type="number" step="0.1" id="peso_kg" name="peso_kg" class="form-control" placeholder="Ej. 70.5"></div>' +
      '<div class="form-group"><label for="talla_cm" class="form-label" style="font-weight: normal; font-size: 0.82rem;">Talla (cm):</label><input type="number" step="1" id="talla_cm" name="talla_cm" class="form-control" placeholder="Ej. 175"></div>' +
      '</div>' +
      '</div>' +
      '<div class="form-group"><label for="motivo_consulta" class="form-label">Motivo de Consulta y Síntomas:</label><textarea id="motivo_consulta" name="motivo_consulta" class="form-control" rows="2" required>' +
      escapeHtml(citaSeleccionada ? citaSeleccionada.motivo : '') +
      '</textarea></div>' +
      '<div class="form-group"><label for="diagnostico" class="form-label">Diagnóstico Clínico:</label><input type="text" id="diagnostico" name="diagnostico" class="form-control" required></div>' +
      '<div class="form-group"><label for="tratamiento_receta" class="form-label">Plan de Tratamiento y Receta Médica:</label><textarea id="tratamiento_receta" name="tratamiento_receta" class="form-control" rows="4" required></textarea></div>' +
      '<div class="form-group"><label for="notas" class="form-label">Notas de Evolución u Observaciones Clínicas (opcional):</label><textarea id="notas" name="notas" class="form-control" rows="2"></textarea></div>' +
      '<div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">' +
      '<a href="#/dashboard-medico" class="btn btn-outline">Cancelar</a>' +
      '<button type="submit" class="btn btn-primary">💾 Guardar y Finalizar Expediente</button>' +
      '</div>' +
      '</form>' +
      '</div>' +
      '</div>';

    document.getElementById('form-nuevo-expediente').addEventListener('submit', async function (e) {
      e.preventDefault();
      const form = e.target;
      const payload = {
        id_paciente: Number(form.id_paciente.value),
        id_cita: form.id_cita ? Number(form.id_cita.value) : null,
        fecha: form.fecha.value,
        motivo_consulta: form.motivo_consulta.value.trim(),
        presion_arterial: form.presion_arterial.value.trim() || null,
        temperatura_c: form.temperatura_c.value ? Number(form.temperatura_c.value) : null,
        peso_kg: form.peso_kg.value ? Number(form.peso_kg.value) : null,
        talla_cm: form.talla_cm.value ? Number(form.talla_cm.value) : null,
        diagnostico: form.diagnostico.value.trim(),
        tratamiento_receta: form.tratamiento_receta.value.trim(),
        notas: form.notas.value.trim() || null
      };

      try {
        const res = await api.crearExpediente(payload);
        showToast(
          res.advertencia_agenda
            ? 'Expediente guardado. Aviso: ' + res.advertencia_agenda
            : 'Expediente registrado exitosamente.',
          res.advertencia_agenda ? 'alert-info' : 'alert-success'
        );
        navigate('#/expedientes/' + res.expediente.id);
      } catch (err) {
        showToast(err.message, 'alert-danger');
      }
    });
  } catch (err) {
    renderErrorView('Error al cargar formulario clínico', err.message);
  }
}

async function renderVerExpediente(expedienteId) {
  const user = getUser();
  if (!user) return navigate('#/login');

  appRoot.innerHTML = '<div class="card"><p style="color: var(--text-muted); text-align: center;">Cargando nota médica...</p></div>';

  try {
    const expRes = await api.getExpedientePorId(expedienteId);
    const exp = expRes.expediente;
    const batchRes = await api.getUsuariosBatch([exp.id_paciente, exp.id_medico]);
    const mapa = new Map(
      (batchRes.usuarios || []).map(function (u) {
        return [u.id, u];
      })
    );
    const pac = mapa.get(exp.id_paciente) || {};
    const med = mapa.get(exp.id_medico) || {};

    const volverHref = getPanelRoute(user);
    const volverTexto = user.rol === 'medico' ? '← Volver al Panel' : '← Volver a Mis Expedientes';
    const tieneSignos = exp.presion_arterial || exp.temperatura_c || exp.peso_kg || exp.talla_cm;

    appRoot.innerHTML =
      '<div style="max-width: 800px; margin: 1rem auto;">' +
      '<div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">' +
      '<div><a href="' +
      volverHref +
      '" class="btn btn-outline btn-sm">' +
      volverTexto +
      '</a></div>' +
      '<div><button type="button" id="btn-imprimir" class="btn btn-primary btn-sm">Imprimir / Guardar en PDF</button></div>' +
      '</div>' +
      '<div class="receta-box">' +
      '<div class="receta-header">' +
      '<div><h2 style="color: var(--primary); margin-bottom: 2px;">DOCTU · NOTA MÉDICA</h2><p style="font-size: 0.85rem; color: var(--text-muted);">Expediente Clínico #' +
      exp.id +
      '</p></div>' +
      '<div style="text-align: right; font-size: 0.88rem;"><strong>' +
      escapeHtml(med.nombre_completo || 'Médico #' + exp.id_medico) +
      '</strong><br>' +
      escapeHtml(med.especialidad || 'Medicina General') +
      '<br><span style="color: var(--text-muted);">Cédula Prof: ' +
      escapeHtml(med.cedula || 'En trámite') +
      '</span><br><strong>Fecha:</strong> ' +
      escapeHtml(exp.fecha) +
      '</div>' +
      '</div>' +
      '<div style="background: #ffffff; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem;">' +
      '<div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; font-size: 0.9rem;">' +
      '<div><strong>Paciente:</strong> ' +
      escapeHtml(pac.nombre_completo || 'Paciente #' + exp.id_paciente) +
      '</div>' +
      '<div><strong>CURP:</strong> ' +
      escapeHtml(pac.curp || 'No registrada') +
      '</div>' +
      '<div><strong>Teléfono:</strong> ' +
      escapeHtml(pac.telefono || 'No registrado') +
      '</div>' +
      '</div>' +
      '</div>' +
      (tieneSignos
        ? '<div class="receta-vitals"><div><strong>Presión:</strong> ' +
          escapeHtml(exp.presion_arterial || 'N/A') +
          ' mmHg</div><div><strong>Temperatura:</strong> ' +
          escapeHtml(exp.temperatura_c ? exp.temperatura_c + ' °C' : 'N/A') +
          '</div><div><strong>Peso:</strong> ' +
          escapeHtml(exp.peso_kg ? exp.peso_kg + ' kg' : 'N/A') +
          '</div><div><strong>Talla:</strong> ' +
          escapeHtml(exp.talla_cm ? exp.talla_cm + ' cm' : 'N/A') +
          '</div></div>'
        : '') +
      '<div class="receta-body">' +
      '<div style="margin-bottom: 1.25rem;"><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Motivo de Consulta:</span><p style="font-size: 0.95rem; margin-top: 2px;">' +
      escapeHtml(exp.motivo_consulta) +
      '</p></div>' +
      '<div style="margin-bottom: 1.5rem; padding: 0.5rem 0.75rem; background: rgba(0, 102, 255, 0.05); border-left: 3px solid var(--primary);"><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--primary); font-weight: 700;">Diagnóstico:</span><p style="font-size: 1.05rem; font-weight: 600; color: var(--ink); margin-top: 2px;">' +
      escapeHtml(exp.diagnostico) +
      '</p></div>' +
      '<div style="border-top: 1px dashed rgba(15, 37, 55, 0.18); padding-top: 1.25rem; margin-bottom: 1.5rem;"><h4 style="color: var(--primary); font-size: 1rem; margin-bottom: 0.5rem;">Rx · Tratamiento y Prescripción Médica:</h4><div style="background: #ffffff; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; white-space: pre-line; font-size: 0.95rem; line-height: 1.6;">' +
      escapeHtml(exp.tratamiento_receta) +
      '</div></div>' +
      (exp.notas
        ? '<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 1rem;"><strong>Observaciones Clínicas:</strong><p style="margin-top: 2px;">' +
          escapeHtml(exp.notas) +
          '</p></div>'
        : '') +
      '</div>' +
      '<div class="receta-firma"><strong>' +
      escapeHtml(med.nombre_completo || 'Médico #' + exp.id_medico) +
      '</strong><br>Firma y Cédula Profesional</div>' +
      '</div>' +
      '</div>';

    document.getElementById('btn-imprimir').addEventListener('click', function () {
      window.print();
    });
  } catch (err) {
    renderErrorView('Error al consultar expediente', err.message);
  }
}

async function renderHistorialPaciente(pacienteId) {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'medico') return renderErrorView('Acceso Denegado', 'Esta sección es exclusiva para personal médico.');

  appRoot.innerHTML = '<div class="card"><p style="color: var(--text-muted); text-align: center;">Cargando historial clínico...</p></div>';

  try {
    const results = await Promise.all([api.getUsuarioPorId(pacienteId), api.getHistorialPaciente(pacienteId)]);
    const paciente = results[0].usuario;
    const expedientes = results[1].expedientes || [];

    const idsMedicos = Array.from(
      new Set(
        expedientes
          .map(function (e) {
            return e.id_medico;
          })
          .filter(Boolean)
      )
    );
    const mapaMedicos = new Map();
    if (idsMedicos.length > 0) {
      const batchRes = await api.getUsuariosBatch(idsMedicos);
      (batchRes.usuarios || []).forEach(function (u) {
        mapaMedicos.set(u.id, u);
      });
    }

    const tarjetas = expedientes
      .map(function (e) {
        const med = mapaMedicos.get(e.id_medico) || {};
        const tieneSignos = e.presion_arterial || e.temperatura_c || e.peso_kg || e.talla_cm;
        return (
          '<div style="border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.25rem; background: rgba(255, 255, 255, 0.82);">' +
          '<div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--glass-border-subtle); padding-bottom: 0.5rem; margin-bottom: 0.75rem; gap: 0.5rem; flex-wrap: wrap;">' +
          '<div><h3 style="font-size: 1.05rem; color: var(--primary); margin-bottom: 2px;">Consulta del ' +
          escapeHtml(e.fecha) +
          '</h3><p style="font-size: 0.85rem; color: var(--text-muted);">Médico: ' +
          escapeHtml(med.nombre_completo || 'Médico #' + e.id_medico) +
          ' (' +
          escapeHtml(med.especialidad || 'Medicina General') +
          ')</p></div>' +
          '<a href="#/expedientes/' +
          e.id +
          '" class="btn btn-sm btn-outline">Ver Nota Completa / Imprimir</a>' +
          '</div>' +
          '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 0.75rem;">' +
          '<div><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Motivo:</span><p style="font-size: 0.9rem;">' +
          escapeHtml(e.motivo_consulta) +
          '</p></div>' +
          '<div><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Diagnóstico:</span><p style="font-size: 0.95rem; font-weight: 600; color: var(--ink);">' +
          escapeHtml(e.diagnostico) +
          '</p></div>' +
          '</div>' +
          (tieneSignos
            ? '<div style="background: rgba(240, 245, 250, 0.85); border: 1px solid var(--glass-border); padding: 6px 12px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 0.75rem; display: flex; gap: 1rem; flex-wrap: wrap;"><span><strong>P/A:</strong> ' +
              escapeHtml(e.presion_arterial || 'N/A') +
              '</span><span><strong>Temp:</strong> ' +
              escapeHtml(e.temperatura_c ? e.temperatura_c + ' °C' : 'N/A') +
              '</span><span><strong>Peso:</strong> ' +
              escapeHtml(e.peso_kg ? e.peso_kg + ' kg' : 'N/A') +
              '</span><span><strong>Talla:</strong> ' +
              escapeHtml(e.talla_cm ? e.talla_cm + ' cm' : 'N/A') +
              '</span></div>'
            : '') +
          '<div style="background: rgba(240, 245, 250, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.75rem 1rem;"><span style="font-size: 0.78rem; text-transform: uppercase; color: var(--primary); font-weight: 700;">Tratamiento / Receta:</span><p style="margin-top: 4px; font-size: 0.9rem; white-space: pre-line;">' +
          escapeHtml(e.tratamiento_receta) +
          '</p></div>' +
          '</div>'
        );
      })
      .join('');

    appRoot.innerHTML =
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">' +
      '<div>' +
      '<h2 style="color: var(--primary);">Historial Clínico de ' +
      escapeHtml(paciente.nombre_completo) +
      '</h2>' +
      '<p style="color: var(--text-muted); font-size: 0.9rem;">CURP: ' +
      escapeHtml(paciente.curp || 'No registrada') +
      ' | Tel: ' +
      escapeHtml(paciente.telefono || 'Sin teléfono') +
      ' | ' +
      escapeHtml(paciente.email || '') +
      '</p>' +
      '</div>' +
      '<div class="btn-group">' +
      '<a href="#/dashboard-medico" class="btn btn-outline btn-sm">← Volver al Panel</a>' +
      '<a href="#/expedientes/nuevo?pacienteId=' +
      paciente.id +
      '" class="btn btn-primary btn-sm">+ Nuevo Expediente</a>' +
      '</div>' +
      '</div>' +
      '<div class="card" style="margin-bottom: 0;">' +
      '<div class="card-header"><div class="card-title">Consultas y Notas Médicas Registradas (' +
      expedientes.length +
      ')</div></div>' +
      (expedientes.length === 0
        ? '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Este paciente aún no cuenta con expedientes registrados.</p>'
        : '<div style="display: flex; flex-direction: column; gap: 1rem;">' + tarjetas + '</div>') +
      '</div>';

    bindCardGlow();
  } catch (err) {
    renderErrorView('Error al cargar historial', err.message);
  }
}

function render() {
  const route = getRoute();
  renderNavbar(route.path);

  if (route.path === '/' || route.path === '') return renderInicio();
  if (route.path === '/login') return renderLogin(route.params);
  if (route.path === '/registro') return renderRegistro(route.params);
  if (route.path === '/dashboard-medico') return renderDashboardMedico(route.params);
  if (route.path === '/portal-paciente') return renderPortalPaciente();
  if (route.path === '/citas/nueva') return renderNuevaCita(route.params);
  if (route.path === '/expedientes/nuevo') return renderNuevoExpediente(route.params);

  const matchHistorial = route.path.match(/^\/expedientes\/paciente\/(\d+)$/);
  if (matchHistorial) return renderHistorialPaciente(matchHistorial[1]);

  const matchVerExp = route.path.match(/^\/expedientes\/(\d+)$/);
  if (matchVerExp) return renderVerExpediente(matchVerExp[1]);

  renderErrorView('Página no encontrada (404)', 'La ruta solicitada no existe en la aplicación.');
}

window.addEventListener('hashchange', render);
initLiquidCanvas();
render();