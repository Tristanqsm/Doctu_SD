const GATEWAY_URL = 'http://localhost:8080/api';
const TOKEN_KEY = 'doctu_token';
const USER_KEY = 'doctu_user';

const ASSETS = {
  icon: '/assets/Icon.png',
  logo: '/assets/Logo.png'
};

const ICONS = {
  arrowRight:
    '<svg class="arrow-right" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h9"/><path d="M8.5 4l4 4-4 4"/></svg>',
  arrowLeft:
    '<svg class="arrow-left" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 8h-9"/><path d="M7.5 4l-4 4 4 4"/></svg>',
  plus:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M8 3.2v9.6"/><path d="M3.2 8h9.6"/></svg>',
  close:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 4l8 8"/><path d="M12 4l-8 8"/></svg>',
  print:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6V2.5h8V6"/><rect x="2.5" y="6" width="11" height="5.5" rx="1.5"/><path d="M4.5 9.5h7v4h-7z"/></svg>'
};

let navbarRoot = null;
let appRoot = null;

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

function renderDegradedBanner(servicio, mensaje) {
  return (
    '<div class="degraded-banner">' +
      '<span class="status-dot warn"></span>' +
      '<div>' +
        '<strong>Modo degradado · ' + escapeHtml(servicio) + '</strong>' +
        '<span>' + escapeHtml(mensaje || 'Servicio temporalmente no disponible.') + '</span>' +
      '</div>' +
    '</div>'
  );
}

function showToast(text, type) {
  const toastType = type || 'alert-info';
  let container = document.querySelector('.alert-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'alert-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = 'alert ' + toastType;

  const dot = document.createElement('span');
  dot.className = 'alert-dot';

  const label = document.createElement('span');
  label.textContent = text;

  el.appendChild(dot);
  el.appendChild(label);
  container.appendChild(el);

  const hide = function () {
    if (!el.parentNode) return;
    el.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-14px) scale(0.94)';
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 280);
  };

  el.addEventListener('click', hide);
  setTimeout(hide, 3800);
}

function bindInteractiveGlow() {
  document.querySelectorAll('.card, .hero-stage').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - rect.left + 'px');
      el.style.setProperty('--my', e.clientY - rect.top + 'px');
    });
  });
}

function nuevaIdempotencyKey() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'k-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
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
    throw new Error('Sin conexión con el API Gateway.');
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
  crearCita: function (payload, idempotencyKey) {
    return request('/agenda/citas', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    });
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
  crearExpediente: function (payload, idempotencyKey) {
    return request('/expedientes/expedientes', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    });
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
      '<li><a href="#/login" class="nav-link ' + (currentPath === '/login' ? 'active' : '') + '">Iniciar sesión</a></li>' +
      '<li><a href="#/registro" class="btn btn-primary btn-sm">Crear cuenta</a></li>';
  } else if (user.rol === 'medico') {
    const nombre = (user.nombre || 'Médico').replace(/^Dra?\.\s*/i, '').split(' ')[0];
    navItems =
      '<li><a href="#/dashboard-medico" class="nav-link ' + (currentPath === '/dashboard-medico' ? 'active' : '') + '">Agenda</a></li>' +
      '<li><a href="#/citas/nueva" class="nav-link ' + (currentPath === '/citas/nueva' ? 'active' : '') + '">Nueva cita</a></li>' +
      '<li><a href="#/expedientes/nuevo" class="nav-link ' + (currentPath === '/expedientes/nuevo' ? 'active' : '') + '">Nueva consulta</a></li>' +
      '<li class="nav-divider"></li>' +
      '<li><span class="user-pill"><span class="status-dot"></span>Dr. ' + escapeHtml(nombre) + '</span></li>' +
      '<li><button type="button" id="btn-logout" class="nav-link nav-link-danger">Salir</button></li>';
  } else {
    const nombre = (user.nombre || 'Paciente').split(' ')[0];
    navItems =
      '<li><a href="#/portal-paciente" class="nav-link ' + (currentPath === '/portal-paciente' ? 'active' : '') + '">Portal</a></li>' +
      '<li><a href="#/citas/nueva" class="nav-link ' + (currentPath === '/citas/nueva' ? 'active' : '') + '">Nueva cita</a></li>' +
      '<li class="nav-divider"></li>' +
      '<li><span class="user-pill"><span class="status-dot"></span>' + escapeHtml(nombre) + '</span></li>' +
      '<li><button type="button" id="btn-logout" class="nav-link nav-link-danger">Salir</button></li>';
  }

  navbarRoot.innerHTML =
    '<nav class="navbar">' +
      '<a href="' + brandHref + '" class="navbar-brand">' +
        '<img src="' + ASSETS.icon + '" alt="DOCTU" class="brand-icon" onerror="this.style.display=\'none\'">' +
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
      showToast('Sesión cerrada.', 'alert-info');
      navigate('#/login');
    });
  }
}

function renderErrorView(title, mensaje) {
  const user = getUser();
  const panelHref = user ? getPanelRoute(user) : '#/';

  appRoot.innerHTML =
    '<div class="container-narrow reveal">' +
      '<div class="card" style="text-align: center; padding: 2.6rem 2rem;">' +
        '<div class="page-kicker" style="color: var(--danger);">Estado</div>' +
        '<h2 class="auth-title" style="margin-bottom: 0.6rem;">' + escapeHtml(title) + '</h2>' +
        '<p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 1.6rem;">' + escapeHtml(mensaje) + '</p>' +
        '<a href="' + panelHref + '" class="btn btn-primary">' + ICONS.arrowLeft + (user ? 'Volver' : 'Inicio') + '</a>' +
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
    '<div style="padding: 0 1.5rem 1.5rem; flex: 1; display: flex;">' +
      '<section class="hero-stage reveal">' +
        '<span class="crosshair ch-tl">+</span>' +
        '<span class="crosshair ch-tr">+</span>' +
        '<span class="crosshair ch-bl">+</span>' +
        '<span class="crosshair ch-br">+</span>' +

        '<div class="hero-top">' +
          '<div>' +
            '<div class="hero-kicker">Plataforma clínica</div>' +
            '<h2 class="hero-lead">Historiales clínicos y citas en un solo lugar.</h2>' +
            '<div class="hero-actions">' +
              '<a href="#/login" class="btn btn-primary">Iniciar sesión ' + ICONS.arrowRight + '</a>' +
              '<a href="#/registro" class="btn btn-accent">Crear cuenta ' + ICONS.arrowRight + '</a>' +
            '</div>' +
          '</div>' +
          '<div class="hero-logo-slot">' +
            '<img src="' + ASSETS.logo + '" alt="DOCTU" class="hero-logo-img" onerror="this.parentNode.style.display=\'none\'">' +
          '</div>' +
        '</div>' +

        '<div class="hero-center">' +
          '<div class="emblem-orbit">' +
            '<div class="emblem-ring"></div>' +
            '<div class="emblem-halo"></div>' +
            '<img src="' + ASSETS.icon + '" alt="DOCTU" class="emblem-icon" onerror="this.style.display=\'none\'">' +
          '</div>' +
        '</div>' +

        '<div class="hero-bottom">' +
          '<h1 class="hero-wordmark">DOCTU</h1>' +
          '<ul class="hero-meta-list">' +
            '<li>Expedientes</li>' +
            '<li>Agenda</li>' +
            '<li>Recetas</li>' +
          '</ul>' +
        '</div>' +
      '</section>' +
    '</div>';

  bindInteractiveGlow();
}

function renderLogin(params) {
  const user = getUser();
  if (user) {
    navigate(getPanelRoute(user));
    return;
  }

  const rolDefecto = params.get('rol') === 'medico' ? 'medico' : 'paciente';

  appRoot.innerHTML =
    '<div class="container-narrow reveal">' +
      '<div class="card" style="padding: 2.2rem;">' +
        '<div class="auth-brand">' +
          '<img src="' + ASSETS.logo + '" alt="DOCTU" class="auth-logo" onerror="this.src=\'' + ASSETS.icon + '\'">' +
          '<h2 class="auth-title">Iniciar sesión</h2>' +
        '</div>' +
        '<form id="form-login" autocomplete="on">' +
          '<div class="form-group">' +
            '<label class="form-label">Perfil</label>' +
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
            '<label for="email" class="form-label">Correo</label>' +
            '<input type="email" id="email" name="email" class="form-control" placeholder="correo@doctu.com" autocomplete="username" required>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="password" class="form-label">Contraseña</label>' +
            '<input type="password" id="password" name="password" class="form-control" placeholder="••••••••" autocomplete="current-password" required>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Entrar ' + ICONS.arrowRight + '</button>' +
        '</form>' +
        '<p style="text-align: center; margin-top: 1.4rem; font-size: 0.83rem; color: var(--muted);">' +
          '<a href="#/registro" style="color: var(--iris); font-weight: 600; text-decoration: none;">Crear cuenta nueva</a>' +
        '</p>' +
      '</div>' +
    '</div>';

  bindInteractiveGlow();

  document.getElementById('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const data = await api.login({
        rol: form.rol.value,
        email: form.email.value.trim(),
        password: form.password.value
      });
      saveSession(data.token, data.usuario);
      showToast(data.usuario.nombre, 'alert-success');
      navigate(data.usuario.rol === 'medico' ? '#/dashboard-medico' : '#/portal-paciente');
    } catch (err) {
      submitBtn.disabled = false;
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
    '<div class="container-narrow reveal" style="max-width: 520px;">' +
      '<div class="card" style="padding: 2.2rem;">' +
        '<div class="auth-brand">' +
          '<img src="' + ASSETS.logo + '" alt="DOCTU" class="auth-logo" onerror="this.src=\'' + ASSETS.icon + '\'">' +
          '<h2 class="auth-title">Crear cuenta</h2>' +
        '</div>' +
        '<form id="form-registro">' +
          '<div class="form-group">' +
            '<label class="form-label">Perfil</label>' +
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
            '<label for="nombreCompleto" class="form-label">Nombre completo</label>' +
            '<input type="text" id="nombreCompleto" name="nombreCompleto" class="form-control" required>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="email" class="form-label">Correo</label>' +
              '<input type="email" id="email" name="email" class="form-control" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="telefono" class="form-label">Teléfono</label>' +
              '<input type="tel" id="telefono" name="telefono" class="form-control">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="password" class="form-label">Contraseña</label>' +
            '<input type="password" id="password" name="password" class="form-control" required>' +
          '</div>' +
          '<div id="campos-paciente" style="display: ' + (rolDefecto === 'paciente' ? 'block' : 'none') + ';">' +
            '<div class="form-group">' +
              '<label for="curp" class="form-label">CURP</label>' +
              '<input type="text" id="curp" name="curp" class="form-control">' +
            '</div>' +
          '</div>' +
          '<div id="campos-medico" style="display: ' + (rolDefecto === 'medico' ? 'block' : 'none') + ';">' +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label for="especialidad" class="form-label">Especialidad</label>' +
                '<input type="text" id="especialidad" name="especialidad" class="form-control">' +
              '</div>' +
              '<div class="form-group">' +
                '<label for="cedula" class="form-label">Cédula</label>' +
                '<input type="text" id="cedula" name="cedula" class="form-control">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Registrar ' + ICONS.arrowRight + '</button>' +
        '</form>' +
        '<p style="text-align: center; margin-top: 1.4rem; font-size: 0.83rem; color: var(--muted);">' +
          '<a href="#/login" style="color: var(--iris); font-weight: 600; text-decoration: none;">Iniciar sesión</a>' +
        '</p>' +
      '</div>' +
    '</div>';

  bindInteractiveGlow();

  const form = document.getElementById('form-registro');
  const camposPaciente = document.getElementById('campos-paciente');
  const camposMedico = document.getElementById('campos-medico');

  form.querySelectorAll('input[name="rol"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      const esMedico = form.rol.value === 'medico';
      camposPaciente.style.display = esMedico ? 'none' : 'block';
      camposMedico.style.display = esMedico ? 'block' : 'none';
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

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
      showToast('Cuenta creada.', 'alert-success');
      navigate('#/login?rol=' + encodeURIComponent(payload.rol));
    } catch (err) {
      submitBtn.disabled = false;
      showToast(err.message, 'alert-danger');
    }
  });
}

async function renderDashboardMedico(params) {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'medico') return renderErrorView('Acceso restringido', 'Vista exclusiva para personal médico.');

  const busqueda = (params.get('q') || '').trim();
  appRoot.innerHTML = '<div class="container"><div class="card"><div class="empty-state">Cargando...</div></div></div>';

  const settled = await Promise.allSettled([
    api.getPerfil(),
    api.getCitas(),
    api.getExpedientes(),
    api.getPacientes(busqueda)
  ]);

  if (settled.every(function (r) { return r.status === 'rejected'; })) {
    return renderErrorView('Sin respuesta', settled[0].reason.message);
  }

  const perfil =
    settled[0].status === 'fulfilled' && settled[0].value.usuario ? settled[0].value.usuario : user;

  const agendaOk = settled[1].status === 'fulfilled';
  const agendaError = agendaOk ? null : settled[1].reason.message;
  const citasRes = agendaOk ? settled[1].value : {};

  const expedientesOk = settled[2].status === 'fulfilled';
  const expedientesError = expedientesOk ? null : settled[2].reason.message;
  const expedientesRes = expedientesOk ? settled[2].value : {};

  const pacientesOk = settled[3].status === 'fulfilled';
  const pacientesError = pacientesOk ? null : settled[3].reason.message;
  const pacientes = pacientesOk ? settled[3].value.pacientes || [] : [];

  const hoy = citasRes.hoy || new Date().toISOString().split('T')[0];
  const citas = citasRes.citas || [];
  const totalCitasHoy = agendaOk ? (citasRes.resumen && citasRes.resumen.totalCitasHoy) || 0 : '—';
  const citasPendientes = agendaOk ? (citasRes.resumen && citasRes.resumen.citasPendientes) || 0 : '—';
  const totalExpedientes = expedientesOk
    ? typeof expedientesRes.total === 'number'
      ? expedientesRes.total
      : (expedientesRes.expedientes || []).length
    : '—';

  const idsPacientes = Array.from(
    new Set(citas.map(function (c) { return c.id_paciente; }).filter(Boolean))
  );
  const mapaPacientes = new Map();
  if (idsPacientes.length > 0) {
    try {
      const batchRes = await api.getUsuariosBatch(idsPacientes);
      (batchRes.usuarios || []).forEach(function (u) {
        mapaPacientes.set(u.id, u);
      });
    } catch (e) {}
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
        '<tr class="' + (c.fecha === hoy ? 'cita-hoy' : '') + '">' +
          '<td style="white-space: nowrap;">' +
            '<span class="cell-primary">' + escapeHtml(c.fecha) + '</span>' +
            '<span class="cell-sub mono-plain">' + escapeHtml(c.hora) + '</span>' +
          '</td>' +
          '<td><span class="cell-primary">' + escapeHtml(pac.nombre_completo || 'Paciente #' + c.id_paciente) + '</span></td>' +
          '<td style="white-space: nowrap;">' +
            '<code>' + escapeHtml(pac.curp || '—') + '</code>' +
            '<span class="cell-sub">' + escapeHtml(pac.telefono || '—') + '</span>' +
          '</td>' +
          '<td>' + escapeHtml(c.motivo) + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + escapeHtml(c.estado) + '</span></td>' +
          '<td style="text-align: right; white-space: nowrap;">' +
            '<div class="btn-group">' +
              (puedeAtender
                ? '<a href="#/expedientes/nuevo?citaId=' + c.id + '&pacienteId=' + c.id_paciente + '" class="btn btn-sm btn-primary">Atender</a>'
                : '') +
              (puedeConfirmar
                ? '<button type="button" class="btn btn-sm btn-outline btn-estado-cita" data-id="' + c.id + '" data-estado="Confirmada">Confirmar</button>'
                : '') +
              (puedeCancelar
                ? '<button type="button" class="btn btn-sm btn-ghost-danger btn-estado-cita" data-id="' + c.id + '" data-estado="Cancelada" aria-label="Cancelar">' + ICONS.close + '</button>'
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
          '<td><span class="cell-primary">' + escapeHtml(p.nombre_completo) + '</span></td>' +
          '<td><code>' + escapeHtml(p.curp || '—') + '</code></td>' +
          '<td>' + escapeHtml(p.email) + '</td>' +
          '<td class="mono-plain">' + escapeHtml(p.telefono || '—') + '</td>' +
          '<td style="text-align: right; white-space: nowrap;">' +
            '<div class="btn-group">' +
              '<a href="#/expedientes/paciente/' + p.id + '" class="btn btn-sm btn-outline">Historial</a>' +
              '<a href="#/expedientes/nuevo?pacienteId=' + p.id + '" class="btn btn-sm btn-primary">' + ICONS.plus + ' Consulta</a>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    })
    .join('');

  const contenidoAgenda = agendaError
    ? renderDegradedBanner('servicio-agenda', agendaError)
    : citas.length === 0
      ? '<div class="empty-state">Sin citas programadas.</div>'
      : '<div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Paciente</th><th>Identificación</th><th>Motivo</th><th>Estado</th><th style="text-align: right;">Acciones</th></tr></thead><tbody>' +
        filasCitas +
        '</tbody></table></div>';

  const contenidoPacientes = pacientesError
    ? renderDegradedBanner('servicio-usuarios', pacientesError)
    : pacientes.length === 0
      ? '<div class="empty-state">Sin resultados.</div>'
      : '<div class="table-responsive"><table class="table"><thead><tr><th>Paciente</th><th>CURP</th><th>Correo</th><th>Teléfono</th><th style="text-align: right;">Expediente</th></tr></thead><tbody>' +
        filasPacientes +
        '</tbody></table></div>';

  appRoot.innerHTML =
    '<div class="container">' +
      '<div class="page-header reveal">' +
        '<div>' +
          '<div class="page-kicker">Panel médico</div>' +
          '<h1 class="page-title">' + escapeHtml(tituloMedico) + '</h1>' +
          '<div class="page-meta">' +
            '<span>' + escapeHtml(perfil.especialidad || 'Medicina General') + '</span>' +
            '<span>·</span>' +
            '<code>' + escapeHtml(perfil.cedula || 'Sin cédula') + '</code>' +
          '</div>' +
        '</div>' +
        '<code>' + escapeHtml(hoy) + '</code>' +
      '</div>' +

      '<div class="grid-3 reveal delay-1">' +
        '<div class="stat-card accent-iris">' +
          '<div class="stat-label">Citas hoy</div>' +
          '<div class="stat-num">' + totalCitasHoy + '</div>' +
        '</div>' +
        '<div class="stat-card accent-coral">' +
          '<div class="stat-label">Por atender</div>' +
          '<div class="stat-num">' + citasPendientes + '</div>' +
        '</div>' +
        '<div class="stat-card accent-teal">' +
          '<div class="stat-label">Expedientes</div>' +
          '<div class="stat-num">' + totalExpedientes + '</div>' +
        '</div>' +
      '</div>' +

      (expedientesError ? renderDegradedBanner('servicio-expedientes', expedientesError) : '') +

      '<div class="card reveal delay-2">' +
        '<div class="card-header">' +
          '<div class="card-title">Agenda</div>' +
          '<a href="#/citas/nueva" class="btn btn-sm btn-outline">' + ICONS.plus + ' Nueva cita</a>' +
        '</div>' +
        contenidoAgenda +
      '</div>' +

      '<div class="card reveal delay-3" style="margin-bottom: 0;">' +
        '<div class="card-header">' +
          '<div class="card-title">Pacientes</div>' +
          '<form id="form-buscar-paciente" class="search-form">' +
            '<input type="text" name="q" value="' + escapeHtml(busqueda) + '" class="form-control search-input" placeholder="Nombre o CURP">' +
            '<button type="submit" class="btn btn-sm btn-outline">Buscar</button>' +
            (busqueda ? '<a href="#/dashboard-medico" class="btn btn-sm btn-ghost-danger" aria-label="Limpiar">' + ICONS.close + '</a>' : '') +
          '</form>' +
        '</div>' +
        contenidoPacientes +
      '</div>' +
    '</div>';

  bindInteractiveGlow();

  const formBuscar = document.getElementById('form-buscar-paciente');
  if (formBuscar) {
    formBuscar.addEventListener('submit', function (e) {
      e.preventDefault();
      const qVal = e.target.q.value.trim();
      navigate(qVal ? '#/dashboard-medico?q=' + encodeURIComponent(qVal) : '#/dashboard-medico');
    });
  }

  document.querySelectorAll('.btn-estado-cita').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const citaId = btn.dataset.id;
      const estado = btn.dataset.estado;
      if (estado === 'Cancelada' && !confirm('¿Cancelar esta cita?')) return;
      try {
        await api.actualizarEstadoCita(citaId, estado);
        showToast('Cita #' + citaId + ' · ' + estado, 'alert-success');
        renderDashboardMedico(params);
      } catch (err) {
        showToast(err.message, 'alert-danger');
      }
    });
  });
}

async function renderPortalPaciente() {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'paciente') return renderErrorView('Acceso restringido', 'Vista exclusiva para pacientes.');

  appRoot.innerHTML = '<div class="container"><div class="card"><div class="empty-state">Cargando...</div></div></div>';

  const settled = await Promise.allSettled([
    api.getPerfil(),
    api.getCitas(),
    api.getExpedientes()
  ]);

  if (settled.every(function (r) { return r.status === 'rejected'; })) {
    return renderErrorView('Sin respuesta', settled[0].reason.message);
  }

  const perfil =
    settled[0].status === 'fulfilled' && settled[0].value.usuario ? settled[0].value.usuario : user;

  const agendaOk = settled[1].status === 'fulfilled';
  const agendaError = agendaOk ? null : settled[1].reason.message;
  const citas = agendaOk ? settled[1].value.citas || [] : [];

  const expedientesOk = settled[2].status === 'fulfilled';
  const expedientesError = expedientesOk ? null : settled[2].reason.message;
  const expedientes = expedientesOk ? settled[2].value.expedientes || [] : [];

  const idsMedicos = Array.from(
    new Set(
      citas.map(function (c) { return c.id_medico; })
        .concat(expedientes.map(function (e) { return e.id_medico; }))
        .filter(Boolean)
    )
  );

  const mapaMedicos = new Map();
  if (idsMedicos.length > 0) {
    try {
      const batchRes = await api.getUsuariosBatch(idsMedicos);
      (batchRes.usuarios || []).forEach(function (u) {
        mapaMedicos.set(u.id, u);
      });
    } catch (e) {}
  }

  const filasCitas = citas
    .map(function (c) {
      const med = mapaMedicos.get(c.id_medico) || {};
      const badgeClass = 'badge-' + String(c.estado || '').toLowerCase();
      const puedeCancelar = c.estado === 'Pendiente' || c.estado === 'Confirmada';

      return (
        '<tr>' +
          '<td style="white-space: nowrap;">' +
            '<span class="cell-primary">' + escapeHtml(c.fecha) + '</span>' +
            '<span class="cell-sub mono-plain">' + escapeHtml(c.hora) + '</span>' +
          '</td>' +
          '<td>' +
            '<span class="cell-primary">' + escapeHtml(med.nombre_completo || 'Médico #' + c.id_medico) + '</span>' +
            '<span class="cell-sub">' + escapeHtml(med.especialidad || 'Medicina General') + '</span>' +
          '</td>' +
          '<td>' + escapeHtml(c.motivo) + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + escapeHtml(c.estado) + '</span></td>' +
          '<td style="text-align: right;">' +
            (puedeCancelar
              ? '<button type="button" class="btn btn-sm btn-ghost-danger btn-cancelar-cita" data-id="' + c.id + '">Cancelar</button>'
              : '<span class="mono-plain">—</span>') +
          '</td>' +
        '</tr>'
      );
    })
    .join('');

  const itemsExpedientes = expedientes
    .map(function (e) {
      const med = mapaMedicos.get(e.id_medico) || {};
      return (
        '<article class="record-item">' +
          '<div class="record-head">' +
            '<div>' +
              '<div class="record-date">' + escapeHtml(e.fecha) + '</div>' +
              '<div class="cell-sub">' +
                escapeHtml(med.nombre_completo || 'Médico #' + e.id_medico) +
                ' · ' + escapeHtml(med.especialidad || 'Medicina General') +
              '</div>' +
            '</div>' +
            '<a href="#/expedientes/' + e.id + '" class="btn btn-sm btn-outline">Receta ' + ICONS.arrowRight + '</a>' +
          '</div>' +
          '<div class="record-grid">' +
            '<div><span class="field-kicker">Diagnóstico</span><p class="cell-primary">' + escapeHtml(e.diagnostico) + '</p></div>' +
            '<div><span class="field-kicker">Motivo</span><p>' + escapeHtml(e.motivo_consulta) + '</p></div>' +
          '</div>' +
          '<div class="rx-box">' + escapeHtml(e.tratamiento_receta) + '</div>' +
        '</article>'
      );
    })
    .join('');

  const contenidoCitas = agendaError
    ? renderDegradedBanner('servicio-agenda', agendaError)
    : citas.length === 0
      ? '<div class="empty-state">Sin citas programadas.</div>'
      : '<div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Médico</th><th>Motivo</th><th>Estado</th><th style="text-align: right;">Acción</th></tr></thead><tbody>' +
        filasCitas +
        '</tbody></table></div>';

  const contenidoExpedientes = expedientesError
    ? renderDegradedBanner('servicio-expedientes', expedientesError)
    : expedientes.length === 0
      ? '<div class="empty-state">Sin expedientes registrados.</div>'
      : '<div class="record-list">' + itemsExpedientes + '</div>';

  appRoot.innerHTML =
    '<div class="container">' +
      '<div class="page-header reveal">' +
        '<div>' +
          '<div class="page-kicker">Portal del paciente</div>' +
          '<h1 class="page-title">' + escapeHtml(perfil.nombre || user.nombre) + '</h1>' +
          '<div class="page-meta">' +
            '<code>' + escapeHtml(perfil.curp || 'Sin CURP') + '</code>' +
            '<span>·</span>' +
            '<span>' + escapeHtml(perfil.telefono || 'Sin teléfono') + '</span>' +
            '<span>·</span>' +
            '<span>' + escapeHtml(perfil.email || user.email) + '</span>' +
          '</div>' +
        '</div>' +
        '<a href="#/citas/nueva" class="btn btn-primary">' + ICONS.plus + ' Nueva cita</a>' +
      '</div>' +

      '<div class="card reveal delay-1">' +
        '<div class="card-header"><div class="card-title">Citas</div></div>' +
        contenidoCitas +
      '</div>' +

      '<div class="card reveal delay-2" style="margin-bottom: 0;">' +
        '<div class="card-header"><div class="card-title">Historial clínico</div></div>' +
        contenidoExpedientes +
      '</div>' +
    '</div>';

  bindInteractiveGlow();

  document.querySelectorAll('.btn-cancelar-cita').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('¿Cancelar esta cita?')) return;
      try {
        await api.actualizarEstadoCita(btn.dataset.id, 'Cancelada');
        showToast('Cita cancelada.', 'alert-success');
        renderPortalPaciente();
      } catch (err) {
        showToast(err.message, 'alert-danger');
      }
    });
  });
}

async function renderNuevaCita(params) {
  const user = getUser();
  if (!user) return navigate('#/login');

  const pacientePreseleccionado = params.get('pacienteId') || '';
  appRoot.innerHTML = '<div class="container-narrow"><div class="card"><div class="empty-state">Cargando...</div></div></div>';

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
        ? '<div class="form-group"><label for="id_paciente" class="form-label">Paciente</label><select name="id_paciente" id="id_paciente" class="form-control" required><option value="">Seleccionar</option>' +
          pacientes
            .map(function (p) {
              return (
                '<option value="' + p.id + '" ' +
                (String(pacientePreseleccionado) === String(p.id) ? 'selected' : '') + '>' +
                escapeHtml(p.nombre_completo) +
                (p.curp ? ' · ' + escapeHtml(p.curp) : '') +
                '</option>'
              );
            })
            .join('') +
          '</select></div>'
        : '<div class="form-group"><label for="id_medico" class="form-label">Médico</label><select name="id_medico" id="id_medico" class="form-control" required><option value="">Seleccionar</option>' +
          medicos
            .map(function (m) {
              return (
                '<option value="' + m.id + '">' +
                escapeHtml(m.nombre_completo) +
                ' · ' + escapeHtml(m.especialidad || 'Medicina General') +
                '</option>'
              );
            })
            .join('') +
          '</select></div>';

    appRoot.innerHTML =
      '<div class="container-narrow reveal" style="max-width: 560px;">' +
        '<div class="page-header">' +
          '<div>' +
            '<div class="page-kicker">Agenda</div>' +
            '<h1 class="page-title">Nueva cita</h1>' +
          '</div>' +
          '<a href="' + volverHref + '" class="btn btn-outline btn-sm">' + ICONS.arrowLeft + ' Volver</a>' +
        '</div>' +
        '<div class="card">' +
          '<form id="form-nueva-cita">' +
            selectorHtml +
            '<div class="form-row">' +
              '<div class="form-group"><label for="fecha" class="form-label">Fecha</label><input type="date" id="fecha" name="fecha" class="form-control" value="' + manana + '" min="' + hoy + '" required></div>' +
              '<div class="form-group"><label for="hora" class="form-label">Hora</label><input type="time" id="hora" name="hora" class="form-control" value="10:00" required></div>' +
            '</div>' +
            '<div class="form-group"><label for="motivo" class="form-label">Motivo</label><textarea id="motivo" name="motivo" class="form-control" rows="3" required></textarea></div>' +
            '<button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.4rem;">Confirmar cita ' + ICONS.arrowRight + '</button>' +
          '</form>' +
        '</div>' +
      '</div>';

    bindInteractiveGlow();

    const idempotencyKeyCita = nuevaIdempotencyKey();
    document.getElementById('form-nueva-cita').addEventListener('submit', async function (e) {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

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
        await api.crearCita(payload, idempotencyKeyCita);
        showToast('Cita registrada.', 'alert-success');
        navigate(volverHref);
      } catch (err) {
        submitBtn.disabled = false;
        showToast(err.message, 'alert-danger');
      }
    });
  } catch (err) {
    renderErrorView('Error', err.message);
  }
}

async function renderNuevoExpediente(params) {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'medico') return renderErrorView('Acceso restringido', 'Vista exclusiva para personal médico.');

  const pacienteIdParam = params.get('pacienteId') || '';
  const citaIdParam = params.get('citaId') || '';

  appRoot.innerHTML = '<div class="container-medium"><div class="card"><div class="empty-state">Cargando...</div></div></div>';

  try {
    const results = await Promise.all([
      api.getPacientes(''),
      citaIdParam
        ? api.getCitaPorId(citaIdParam).catch(function () { return null; })
        : Promise.resolve(null)
    ]);

    const pacientes = results[0].pacientes || [];
    const citaSeleccionada = results[1] && results[1].cita ? results[1].cita : null;
    const idCitaFinal = citaSeleccionada
      ? citaSeleccionada.id
      : citaIdParam && Number(citaIdParam) > 0
        ? Number(citaIdParam)
        : null;
    const pacienteSeleccionado =
      pacientes.find(function (p) { return String(p.id) === String(pacienteIdParam); }) || null;
    const hoy = new Date().toISOString().split('T')[0];

    const pacienteFieldHtml = pacienteSeleccionado
      ? '<input type="hidden" name="id_paciente" value="' + pacienteSeleccionado.id + '">' +
        '<input type="text" class="form-control" value="' +
          escapeHtml(pacienteSeleccionado.nombre_completo) +
          (pacienteSeleccionado.curp ? ' · ' + escapeHtml(pacienteSeleccionado.curp) : '') +
        '" readonly>'
      : '<select name="id_paciente" id="id_paciente" class="form-control" required><option value="">Seleccionar</option>' +
        pacientes
          .map(function (p) {
            return (
              '<option value="' + p.id + '" ' +
              (String(pacienteIdParam) === String(p.id) ? 'selected' : '') + '>' +
              escapeHtml(p.nombre_completo) +
              (p.curp ? ' · ' + escapeHtml(p.curp) : '') +
              '</option>'
            );
          })
          .join('') +
        '</select>';

    const avisoAgendaCaida =
      idCitaFinal && !citaSeleccionada
        ? renderDegradedBanner(
            'servicio-agenda',
            'Cita #' + idCitaFinal + ' sin detalle disponible. El cierre quedará encolado en Outbox al guardar.'
          )
        : '';

    appRoot.innerHTML =
      '<div class="container-medium reveal">' +
        '<div class="page-header">' +
          '<div>' +
            '<div class="page-kicker">Expediente clínico</div>' +
            '<h1 class="page-title">Nueva consulta</h1>' +
          '</div>' +
          '<a href="#/dashboard-medico" class="btn btn-outline btn-sm">' + ICONS.arrowLeft + ' Volver</a>' +
        '</div>' +
        avisoAgendaCaida +
        '<div class="card">' +
          '<form id="form-nuevo-expediente">' +
            (idCitaFinal ? '<input type="hidden" name="id_cita" value="' + idCitaFinal + '">' : '') +
            '<div class="form-row">' +
              '<div class="form-group" style="flex: 2;"><label for="id_paciente" class="form-label">Paciente</label>' + pacienteFieldHtml + '</div>' +
              '<div class="form-group" style="flex: 1;"><label for="fecha" class="form-label">Fecha</label><input type="date" id="fecha" name="fecha" class="form-control" value="' + hoy + '" required></div>' +
            '</div>' +
            '<div class="vitals-panel">' +
              '<div class="vitals-heading">Signos vitales</div>' +
              '<div class="form-row">' +
                '<div class="form-group"><label for="presion_arterial" class="form-label">Presión (mmHg)</label><input type="text" id="presion_arterial" name="presion_arterial" class="form-control" placeholder="120/80"></div>' +
                '<div class="form-group"><label for="temperatura_c" class="form-label">Temperatura (°C)</label><input type="number" step="0.1" id="temperatura_c" name="temperatura_c" class="form-control" placeholder="36.5"></div>' +
                '<div class="form-group"><label for="peso_kg" class="form-label">Peso (kg)</label><input type="number" step="0.1" id="peso_kg" name="peso_kg" class="form-control" placeholder="70.0"></div>' +
                '<div class="form-group"><label for="talla_cm" class="form-label">Talla (cm)</label><input type="number" step="1" id="talla_cm" name="talla_cm" class="form-control" placeholder="172"></div>' +
              '</div>' +
            '</div>' +
            '<div class="form-group"><label for="motivo_consulta" class="form-label">Motivo</label><textarea id="motivo_consulta" name="motivo_consulta" class="form-control" rows="2" required>' +
              escapeHtml(citaSeleccionada ? citaSeleccionada.motivo : '') +
            '</textarea></div>' +
            '<div class="form-group"><label for="diagnostico" class="form-label">Diagnóstico</label><input type="text" id="diagnostico" name="diagnostico" class="form-control" required></div>' +
            '<div class="form-group"><label for="tratamiento_receta" class="form-label">Tratamiento y receta</label><textarea id="tratamiento_receta" name="tratamiento_receta" class="form-control" rows="4" required></textarea></div>' +
            '<div class="form-group"><label for="notas" class="form-label">Observaciones</label><textarea id="notas" name="notas" class="form-control" rows="2"></textarea></div>' +
            '<div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.4rem;">' +
              '<a href="#/dashboard-medico" class="btn btn-outline">Cancelar</a>' +
              '<button type="submit" class="btn btn-primary">Guardar expediente ' + ICONS.arrowRight + '</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    bindInteractiveGlow();

    const idempotencyKeyExpediente = nuevaIdempotencyKey();
    document.getElementById('form-nuevo-expediente').addEventListener('submit', async function (e) {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

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
        const res = await api.crearExpediente(payload, idempotencyKeyExpediente);
        showToast(
          res.advertencia_agenda
            ? 'Expediente guardado · ' + res.advertencia_agenda
            : 'Expediente registrado.',
          res.advertencia_agenda ? 'alert-info' : 'alert-success'
        );
        navigate('#/expedientes/' + res.expediente.id);
      } catch (err) {
        submitBtn.disabled = false;
        showToast(err.message, 'alert-danger');
      }
    });
  } catch (err) {
    renderErrorView('Error', err.message);
  }
}

async function renderVerExpediente(expedienteId) {
  const user = getUser();
  if (!user) return navigate('#/login');

  appRoot.innerHTML = '<div class="container-medium"><div class="card"><div class="empty-state">Cargando...</div></div></div>';

  try {
    const expRes = await api.getExpedientePorId(expedienteId);
    const exp = expRes.expediente;
    const mapa = new Map();
    try {
      const batchRes = await api.getUsuariosBatch([exp.id_paciente, exp.id_medico]);
      (batchRes.usuarios || []).forEach(function (u) {
        mapa.set(u.id, u);
      });
    } catch (e) {}

    const pac = mapa.get(exp.id_paciente) || {};
    const med = mapa.get(exp.id_medico) || {};

    const volverHref = getPanelRoute(user);
    const tieneSignos = exp.presion_arterial || exp.temperatura_c || exp.peso_kg || exp.talla_cm;

    appRoot.innerHTML =
      '<div class="container-medium reveal">' +
        '<div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">' +
          '<a href="' + volverHref + '" class="btn btn-outline btn-sm">' + ICONS.arrowLeft + ' Volver</a>' +
          '<button type="button" id="btn-imprimir" class="btn btn-primary btn-sm">' + ICONS.print + ' Imprimir</button>' +
        '</div>' +
        '<div class="receta-box">' +
          '<img src="' + ASSETS.icon + '" alt="" class="receta-watermark" onerror="this.style.display=\'none\'">' +
          '<div class="receta-header">' +
            '<div>' +
              '<img src="' + ASSETS.logo + '" alt="DOCTU" class="receta-logo" onerror="this.style.display=\'none\'">' +
              '<span class="mono-plain">NOTA MÉDICA · EXPEDIENTE #' + exp.id + '</span>' +
            '</div>' +
            '<div style="text-align: right; font-size: 0.86rem; line-height: 1.5;">' +
              '<div class="cell-primary">' + escapeHtml(med.nombre_completo || 'Médico #' + exp.id_medico) + '</div>' +
              '<div style="color: var(--muted);">' + escapeHtml(med.especialidad || 'Medicina General') + '</div>' +
              '<div class="mono-plain">Cédula ' + escapeHtml(med.cedula || '—') + '</div>' +
              '<div class="mono-plain">' + escapeHtml(exp.fecha) + '</div>' +
            '</div>' +
          '</div>' +

          '<div class="receta-patient-bar">' +
            '<div><span class="field-kicker">Paciente</span><span class="cell-primary">' + escapeHtml(pac.nombre_completo || 'Paciente #' + exp.id_paciente) + '</span></div>' +
            '<div><span class="field-kicker">CURP</span><code>' + escapeHtml(pac.curp || '—') + '</code></div>' +
            '<div><span class="field-kicker">Teléfono</span><span class="mono-plain">' + escapeHtml(pac.telefono || '—') + '</span></div>' +
          '</div>' +

          (tieneSignos
            ? '<div class="receta-vitals">' +
                '<div><span class="field-kicker">Presión</span>' + escapeHtml(exp.presion_arterial ? exp.presion_arterial + ' mmHg' : '—') + '</div>' +
                '<div><span class="field-kicker">Temperatura</span>' + escapeHtml(exp.temperatura_c ? exp.temperatura_c + ' °C' : '—') + '</div>' +
                '<div><span class="field-kicker">Peso</span>' + escapeHtml(exp.peso_kg ? exp.peso_kg + ' kg' : '—') + '</div>' +
                '<div><span class="field-kicker">Talla</span>' + escapeHtml(exp.talla_cm ? exp.talla_cm + ' cm' : '—') + '</div>' +
              '</div>'
            : '') +

          '<div style="margin-bottom: 1.25rem;">' +
            '<span class="field-kicker">Motivo</span>' +
            '<p style="font-size: 0.94rem; color: var(--ink-soft);">' + escapeHtml(exp.motivo_consulta) + '</p>' +
          '</div>' +

          '<div class="receta-dx">' +
            '<span class="field-kicker" style="color: var(--iris);">Diagnóstico</span>' +
            '<p style="font-size: 1.04rem; font-weight: 700; color: var(--ink);">' + escapeHtml(exp.diagnostico) + '</p>' +
          '</div>' +

          '<div style="margin-bottom: 1.25rem;">' +
            '<span class="field-kicker">Rx · Tratamiento</span>' +
            '<div class="rx-box">' + escapeHtml(exp.tratamiento_receta) + '</div>' +
          '</div>' +

          (exp.notas
            ? '<div style="margin-top: 1.1rem;"><span class="field-kicker">Observaciones</span><p style="font-size: 0.88rem; color: var(--muted);">' + escapeHtml(exp.notas) + '</p></div>'
            : '') +

          '<div class="receta-firma">' +
            '<div class="cell-primary">' + escapeHtml(med.nombre_completo || 'Médico #' + exp.id_medico) + '</div>' +
            '<div class="mono-plain">Firma y cédula profesional</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('btn-imprimir').addEventListener('click', function () {
      window.print();
    });
  } catch (err) {
    renderErrorView('Error', err.message);
  }
}

async function renderHistorialPaciente(pacienteId) {
  const user = getUser();
  if (!user) return navigate('#/login');
  if (user.rol !== 'medico') return renderErrorView('Acceso restringido', 'Vista exclusiva para personal médico.');

  appRoot.innerHTML = '<div class="container"><div class="card"><div class="empty-state">Cargando...</div></div></div>';

  const settled = await Promise.allSettled([
    api.getUsuarioPorId(pacienteId),
    api.getHistorialPaciente(pacienteId)
  ]);

  if (settled[1].status === 'rejected') {
    return renderErrorView('Error', settled[1].reason.message);
  }

  const paciente =
    settled[0].status === 'fulfilled' && settled[0].value.usuario
      ? settled[0].value.usuario
      : { id: pacienteId, nombre_completo: 'Paciente #' + pacienteId };
  const expedientes = settled[1].value.expedientes || [];

  const idsMedicos = Array.from(
    new Set(expedientes.map(function (e) { return e.id_medico; }).filter(Boolean))
  );
  const mapaMedicos = new Map();
  if (idsMedicos.length > 0) {
    try {
      const batchRes = await api.getUsuariosBatch(idsMedicos);
      (batchRes.usuarios || []).forEach(function (u) {
        mapaMedicos.set(u.id, u);
      });
    } catch (e) {}
  }

  const items = expedientes
    .map(function (e) {
      const med = mapaMedicos.get(e.id_medico) || {};
      const tieneSignos = e.presion_arterial || e.temperatura_c || e.peso_kg || e.talla_cm;
      return (
        '<article class="record-item">' +
          '<div class="record-head">' +
            '<div>' +
              '<div class="record-date">' + escapeHtml(e.fecha) + '</div>' +
              '<div class="cell-sub">' +
                escapeHtml(med.nombre_completo || 'Médico #' + e.id_medico) +
                ' · ' + escapeHtml(med.especialidad || 'Medicina General') +
              '</div>' +
            '</div>' +
            '<a href="#/expedientes/' + e.id + '" class="btn btn-sm btn-outline">Receta ' + ICONS.arrowRight + '</a>' +
          '</div>' +
          '<div class="record-grid">' +
            '<div><span class="field-kicker">Motivo</span><p>' + escapeHtml(e.motivo_consulta) + '</p></div>' +
            '<div><span class="field-kicker">Diagnóstico</span><p class="cell-primary">' + escapeHtml(e.diagnostico) + '</p></div>' +
          '</div>' +
          (tieneSignos
            ? '<div class="vitals-strip">' +
                '<span><strong>P/A</strong> ' + escapeHtml(e.presion_arterial || '—') + '</span>' +
                '<span><strong>Temp</strong> ' + escapeHtml(e.temperatura_c ? e.temperatura_c + ' °C' : '—') + '</span>' +
                '<span><strong>Peso</strong> ' + escapeHtml(e.peso_kg ? e.peso_kg + ' kg' : '—') + '</span>' +
                '<span><strong>Talla</strong> ' + escapeHtml(e.talla_cm ? e.talla_cm + ' cm' : '—') + '</span>' +
              '</div>'
            : '') +
          '<div class="rx-box">' + escapeHtml(e.tratamiento_receta) + '</div>' +
        '</article>'
      );
    })
    .join('');

  appRoot.innerHTML =
    '<div class="container">' +
      '<div class="page-header reveal">' +
        '<div>' +
          '<div class="page-kicker">Historial clínico</div>' +
          '<h1 class="page-title">' + escapeHtml(paciente.nombre_completo) + '</h1>' +
          '<div class="page-meta">' +
            '<code>' + escapeHtml(paciente.curp || 'Sin CURP') + '</code>' +
            '<span>·</span>' +
            '<span>' + escapeHtml(paciente.telefono || 'Sin teléfono') + '</span>' +
            (paciente.email ? '<span>·</span><span>' + escapeHtml(paciente.email) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="btn-group">' +
          '<a href="#/dashboard-medico" class="btn btn-outline btn-sm">' + ICONS.arrowLeft + ' Volver</a>' +
          '<a href="#/expedientes/nuevo?pacienteId=' + paciente.id + '" class="btn btn-primary btn-sm">' + ICONS.plus + ' Consulta</a>' +
        '</div>' +
      '</div>' +
      '<div class="card reveal delay-1" style="margin-bottom: 0;">' +
        '<div class="card-header">' +
          '<div class="card-title">Consultas</div>' +
          '<code>' + expedientes.length + '</code>' +
        '</div>' +
        (expedientes.length === 0
          ? '<div class="empty-state">Sin expedientes registrados.</div>'
          : '<div class="record-list">' + items + '</div>') +
      '</div>' +
    '</div>';

  bindInteractiveGlow();
}

function render() {
  if (!navbarRoot || !appRoot) return;
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

  renderErrorView('404', 'Ruta no encontrada.');
}

function boot() {
  navbarRoot = document.getElementById('navbar-root');
  appRoot = document.getElementById('app');
  window.addEventListener('hashchange', render);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}