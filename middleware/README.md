# `middleware/` — Control de Acceso y Sesiones

Esta carpeta centraliza los interceptores de Express encargados de proteger las rutas del monolito **Doctu** (`01-monolito`) verificando la sesión activa y el rol del usuario antes de llegar a los controladores.

---

## Contenido de la carpeta

| Archivo | Responsabilidad | Funciones exportadas |
| :--- | :--- | :--- |
| `auth.js` | Autenticación por sesión y autorización por rol (`medico` / `paciente`) | `requireAuth`, `requireMedico`, `requirePaciente` |

---

## Qué hace `auth.js`

| Middleware | Qué valida | Si no hay sesión | Si el rol no coincide | Si cumple |
| :--- | :--- | :--- | :--- | :--- |
| `requireAuth` | Existencia de `req.session.user` | Guarda `req.originalUrl` en `req.session.redirectAfterLogin` y redirige a `/login?error=Debes iniciar sesión para acceder` | No aplica (permite ambos roles) | Ejecuta `next()` |
| `requireMedico` | Sesión activa y `rol === 'medico'` | Redirige a `/login?error=Debes iniciar sesión` | Renderiza `error` con HTTP `403` (*"Esta sección es exclusiva para personal médico."*) | Ejecuta `next()` |
| `requirePaciente` | Sesión activa y `rol === 'paciente'` | Redirige a `/login?error=Debes iniciar sesión` | Renderiza `error` con HTTP `403` (*"Esta sección es exclusiva para pacientes."*) | Ejecuta `next()` |

---

## Comunicación con otras carpetas

```text
Cliente HTTP ──► routes/*.js ──► middleware/auth.js ──► controllers/*.js
                                        │
                                        ├──► res.redirect('/login?error=...')
                                        └──► views/error.ejs (HTTP 403)
```

- **`routes/`**: Importa estos middlewares y los encadena en las rutas protegidas antes de invocar al controlador correspondiente.
- **`controllers/`**:
  - Depende de `authController.postLogin`, que crea `req.session.user`, y de `authController.logout`, que destruye la sesión.
  - Garantiza a `medicoController`, `pacienteController`, `citaController` y `expedienteController` que `req.session.user` existe y tiene el rol adecuado. La autorización fina a nivel de registro (por ejemplo, impedir que un paciente lea expedientes ajenos) permanece en el controlador (`expedienteController.getVerExpediente`).
- **`views/`**: Ante un error de permisos (HTTP `403`), `requireMedico` y `requirePaciente` renderizan directamente `views/error.ejs` pasando `title`, `mensaje` y `user`.
- **`database/`**: Sin acoplamiento directo; valida únicamente contra el estado de la sesión en memoria, sin consultar SQLite en cada petición.
- **`public/`**: Sin interacción directa.