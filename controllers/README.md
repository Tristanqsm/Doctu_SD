# `controllers/` — Lógica de Negocio

Esta carpeta contiene los controladores MVC del monolito **Doctu** (`01-monolito`). Cada archivo valida entradas HTTP, consulta o modifica directamente la base de datos SQLite y devuelve vistas EJS, redirecciones o respuestas JSON.

---

## Resumen de archivos

| Archivo | Responsabilidad | Funciones exportadas | Tablas SQL |
| :--- | :--- | :--- | :--- |
| `authController.js` | Acceso, registro y sesiones | `getLogin`, `postLogin`, `getRegistro`, `postRegistro`, `logout` | `usuarios` |
| `medicoController.js` | Panel y búsqueda del médico | `getDashboard` | `citas`, `usuarios`, `expedientes` |
| `pacienteController.js` | Portal del paciente | `getPortal` | `citas`, `expedientes`, `usuarios` |
| `citaController.js` | Creación y estados de citas | `getNuevaCita`, `postNuevaCita`, `updateEstadoCita` | `usuarios`, `citas` |
| `expedienteController.js` | Expedientes e historial clínico | `getNuevoExpediente`, `postNuevoExpediente`, `getVerExpediente`, `getHistorialPaciente` | `usuarios`, `citas`, `expedientes` |
| `apiController.js` | Salud del sistema y API JSON | `getHealth`, `getPacientes`, `getCitas`, `getExpedientes` | `usuarios`, `citas`, `expedientes` |

---

## Qué hace cada archivo

### `authController.js`
- **`getLogin` / `getRegistro`**: Si el usuario ya tiene sesión, lo redirige a `/dashboard-medico` o `/portal-paciente`. Si no, renderiza `login` o `registro`.
- **`postLogin`**: Normaliza el correo, valida credenciales y rol contra `usuarios`, guarda el perfil en `req.session.user` y redirige según el rol.
- **`postRegistro`**: Valida campos obligatorios, verifica que el correo no esté duplicado e inserta el usuario guardando campos por rol (`curp` para paciente; `especialidad` con valor por defecto `'Medicina General'` y `cedula` para médico).
- **`logout`**: Destruye la sesión activa y redirige a `/`.

### `medicoController.js`
- **`getDashboard`**: Obtiene todas las citas del médico (`JOIN` con `usuarios`), filtra las de hoy (`citasHoy`), calcula métricas (`totalCitasHoy`, `citasPendientes`, `totalExpedientes`) y busca pacientes por nombre, CURP o correo (`req.query.q`), o muestra los últimos 5 registrados. Renderiza `dashboard-medico`.

### `pacienteController.js`
- **`getPortal`**: Consulta las citas del paciente, su historial de expedientes clínicos (ambos con `JOIN` a datos del médico) y el catálogo de médicos disponibles. Renderiza `portal-paciente`.

### `citaController.js`
- **`getNuevaCita`**: Carga listas de médicos y pacientes, acepta `pacienteId` opcional para preselección y renderiza `nueva-cita`.
- **`postNuevaCita`**: Asigna automáticamente el ID de sesión según el rol (`id_paciente` si es paciente; `id_medico` si es médico y no especificó otro), valida los campos obligatorios e inserta la cita con estado `'Confirmada'`.
- **`updateEstadoCita`**: Valida que el estado esté en `['Pendiente', 'Confirmada', 'Atendida', 'Cancelada']` (devuelve HTTP `400` si no), actualiza la cita y redirige al panel del rol.

### `expedienteController.js`
- **`getNuevoExpediente`**: Carga el catálogo de pacientes y precarga paciente y cita si llegan `pacienteId` o `citaId` por query string. Renderiza `nuevo-expediente`.
- **`postNuevoExpediente`**: Valida campos obligatorios y ejecuta una transacción SQL (`BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`) que inserta el expediente (incluyendo signos vitales opcionales) y, si viene ligado a una cita (`id_cita`), cambia su estado a `'Atendida'`.
- **`getVerExpediente`**: Consulta el expediente con datos de paciente y médico. Devuelve HTTP `404` si no existe y HTTP `403` si un paciente intenta ver un expediente ajeno. Renderiza `ver-expediente`.
- **`getHistorialPaciente`**: Verifica que el paciente exista (HTTP `404` si no) y renderiza `historial-paciente` con todos sus expedientes ordenados del más reciente al más antiguo.

### `apiController.js`
- **`getHealth`**: Devuelve JSON con `status: 'ok'`, `system: 'Doctu Monolito'`, `version: '1.0.0'` y `timestamp`.
- **`getPacientes` / `getCitas` / `getExpedientes`**: Consultan los registros en SQLite (omitiendo contraseñas en pacientes y haciendo `JOIN` de nombres en citas y expedientes) y responden en formato JSON.

---

## Comunicación con otras carpetas

```text
routes/*.js ──► middleware/auth.js ──► controllers/*.js ──► database/db.js
                                              │
                                              ├──► views/*.ejs (HTML SSR)
                                              ├──► res.redirect (flujo entre módulos)
                                              └──► res.json (apiController.js)
```

- **`routes/`**: Relación 1 a 1; cada archivo de rutas llama a su controlador equivalente (`authRoutes.js` → `authController.js`, etc.).
- **`middleware/`**: `middleware/auth.js` valida la sesión antes de entrar a los controladores protegidos, garantizando que `req.session.user` exista.
- **`database/`**: Todos los controladores importan `../database/db` y ejecutan sentencias SQL preparadas síncronas (`db.prepare`).
- **`views/`**: Cinco controladores renderizan plantillas EJS (`login`, `registro`, `dashboard-medico`, `portal-paciente`, `nueva-cita`, `nuevo-expediente`, `ver-expediente`, `historial-paciente` y `error`).
- **`public/`**: Relación indirecta; las vistas generadas cargan `style.css`, `main.js` y las imágenes.
- **Coordinación entre controladores**: No se importan entre sí. Se coordinan mediante `req.session.user`, la base de datos compartida y redirecciones HTTP con alertas en query string (`?success=` / `?error=`).