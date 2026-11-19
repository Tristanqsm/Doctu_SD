# `routes/` — Enrutamiento HTTP

Esta carpeta define los puntos de entrada HTTP del monolito **Doctu** (`01-monolito`) usando `express.Router()`. Cada archivo agrupa las rutas de un módulo, aplica los middlewares de autenticación o rol correspondientes y delega la ejecución a su controlador espejo en `controllers/`.

---

## Resumen de archivos

| Archivo | Controlador vinculado | Middleware aplicado | Cantidad de rutas |
| :--- | :--- | :--- | :--- |
| `authRoutes.js` | `authController.js` | Ninguno (público) | 5 |
| `medicoRoutes.js` | `medicoController.js` | `requireMedico` | 1 |
| `pacienteRoutes.js` | `pacienteController.js` | `requirePaciente` | 1 |
| `citaRoutes.js` | `citaController.js` | `requireAuth` | 3 |
| `expedienteRoutes.js` | `expedienteController.js` | `requireMedico`, `requireAuth` | 4 |
| `apiRoutes.js` | `apiController.js` | Ninguno (público) | 4 |

---

## Qué define cada archivo

### `authRoutes.js`
Rutas públicas para autenticación, registro y cierre de sesión:
- `GET /login` → `authController.getLogin`
- `POST /login` → `authController.postLogin`
- `GET /registro` → `authController.getRegistro`
- `POST /registro` → `authController.postRegistro`
- `GET /logout` → `authController.logout`

### `medicoRoutes.js`
Ruta exclusiva para personal médico:
- `GET /dashboard-medico` → `requireMedico` → `medicoController.getDashboard`

### `pacienteRoutes.js`
Ruta exclusiva para pacientes:
- `GET /portal-paciente` → `requirePaciente` → `pacienteController.getPortal`

### `citaRoutes.js`
Rutas compartidas por cualquier usuario autenticado (médico o paciente):
- `GET /citas/nueva` → `requireAuth` → `citaController.getNuevaCita`
- `POST /citas/nueva` → `requireAuth` → `citaController.postNuevaCita`
- `POST /citas/:id/estado` → `requireAuth` → `citaController.updateEstadoCita`

### `expedienteRoutes.js`
Combina creación/historial exclusivos para médicos con lectura controlada para ambos roles:
- `GET /expedientes/nuevo` → `requireMedico` → `expedienteController.getNuevoExpediente`
- `POST /expedientes/nuevo` → `requireMedico` → `expedienteController.postNuevoExpediente`
- `GET /expedientes/paciente/:id` → `requireMedico` → `expedienteController.getHistorialPaciente`
- `GET /expedientes/:id` → `requireAuth` → `expedienteController.getVerExpediente`

> **Orden de declaración:** `/expedientes/nuevo` y `/expedientes/paciente/:id` están declaradas antes que `/expedientes/:id` para evitar que Express interprete `nuevo` o `paciente` como un `:id`.

### `apiRoutes.js`
Rutas orientadas a respuestas JSON (su prefijo final depende de cómo las monte `server.js`):
- `GET /health` → `apiController.getHealth`
- `GET /pacientes` → `apiController.getPacientes`
- `GET /citas` → `apiController.getCitas`
- `GET /expedientes` → `apiController.getExpedientes`

---

## Comunicación con otras carpetas

```text
Cliente HTTP ──► server.js ──► routes/*.js ──► middleware/auth.js ──► controllers/*.js
```

- **`server.js`**: Monta los seis enrutadores exportados para exponer la superficie HTTP completa del monolito.
- **`middleware/`**: `citaRoutes.js`, `expedienteRoutes.js`, `medicoRoutes.js` y `pacienteRoutes.js` importan `requireAuth`, `requireMedico` y `requirePaciente` desde `../middleware/auth` para filtrar el acceso antes del controlador.
- **`controllers/`**: Relación directa 1 a 1; cada archivo en `routes/` importa únicamente su controlador equivalente y le pasa `req` y `res`.
- **`views/`**: Las plantillas EJS apuntan sus enlaces (`href`) y formularios (`action`) a estas rutas.
- **`database/` y `public/`**: Sin acoplamiento directo.