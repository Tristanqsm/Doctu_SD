const GATEWAY_URL = 'http://localhost:8080/api';

const TOKEN_KEY = 'doctu_token';
const USER_KEY = 'doctu_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error('No se pudo conectar con el API Gateway (puerto 8080).');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession();
      window.location.hash = '#/login';
    }
    throw new Error(data.mensaje || data.error || `Error HTTP ${response.status}`);
  }

  return data;
}

export const api = {
  // Usuarios y Auth
  login: (payload) => request('/usuarios/login', { method: 'POST', body: JSON.stringify(payload) }),
  registro: (payload) => request('/usuarios/registro', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/usuarios/logout', { method: 'POST' }),
  getPerfil: () => request('/usuarios/perfil'),
  getMedicos: () => request('/usuarios/medicos'),
  getPacientes: (q = '') => request(`/usuarios/pacientes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getUsuariosBatch: (ids) => request(`/usuarios/batch?ids=${ids.join(',')}`),
  getUsuarioPorId: (id) => request(`/usuarios/${id}`),

  // Agenda / Citas
  getCitas: () => request('/agenda/citas'),
  getCitaPorId: (id) => request(`/agenda/citas/${id}`),
  crearCita: (payload) => request('/agenda/citas', { method: 'POST', body: JSON.stringify(payload) }),
  actualizarEstadoCita: (id, estado) =>
    request(`/agenda/citas/${id}/estado`, { method: 'POST', body: JSON.stringify({ estado }) }),

  // Expedientes Clínicos
  getExpedientes: () => request('/expedientes/expedientes'),
  getHistorialPaciente: (id) => request(`/expedientes/expedientes/paciente/${id}`),
  getExpedientePorId: (id) => request(`/expedientes/expedientes/${id}`),
  crearExpediente: (payload) =>
    request('/expedientes/expedientes', { method: 'POST', body: JSON.stringify(payload) })
};