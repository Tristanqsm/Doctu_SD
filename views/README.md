# `views/` — Capa de Presentación (SSR con EJS)

Esta carpeta contiene las plantillas EJS que Express renderiza en el servidor para construir la interfaz de usuario del monolito **Doctu** (`01-monolito`). Incluye fragmentos reutilizables en `partials/` y 10 vistas correspondientes a cada flujo del sistema.

---

## Resumen de archivos

| Archivo | Quién la renderiza | Rutas / formularios que consume | Función principal |
| :--- | :--- | :--- | :--- |
| `partials/header.ejs` | Incluida en todas las vistas | — | Encabezado HTML, carga de estilos y navegación superior |
| `partials/footer.ejs` | Incluida en todas las vistas | — | Pie de página y carga de scripts cliente |
| `partials/alert.ejs` | Incluida como parcial compartido | — | Renderizado de alertas de estado/error |
| `index.ejs` | `server.js` (`GET /`) | `/login`, `/registro` | Portada principal y acceso al sistema |
| `login.ejs` | `authController.getLogin` / `postLogin` | `POST /login`, `/registro` | Inicio de sesión con selección de rol (`paciente` / `medico`) |
| `registro.ejs` | `authController.getRegistro` / `postRegistro` | `POST /registro`, `/login` | Registro dinámico de pacientes y médicos |
| `dashboard-medico.ejs` | `medicoController.getDashboard` | `GET /dashboard-medico`, `POST /citas/:id/estado`, `/citas/nueva`, `/expedientes/*` | Panel médico con métricas, agenda y buscador de pacientes |
| `portal-paciente.ejs` | `pacienteController.getPortal` | `/citas/nueva`, `POST /citas/:id/estado`, `/expedientes/:id` | Portal del paciente con citas activas e historial clínico |
| `nueva-cita.ejs` | `citaController.getNuevaCita` | `POST /citas/nueva` | Formulario para agendar cita (adaptado al rol activo) |
| `nuevo-expediente.ejs` | `expedienteController.getNuevoExpediente` | `POST /expedientes/nuevo` | Captura de signos vitales, diagnóstico y receta médica |
| `ver-expediente.ejs` | `expedienteController.getVerExpediente` | `window.print()` | Nota médica y receta en formato imprimible |
| `historial-paciente.ejs` | `expedienteController.getHistorialPaciente` | `/expedientes/nuevo`, `/expedientes/:id`, `/dashboard-medico` | Cronología clínica completa de un paciente para el médico |
| `error.ejs` | `middleware/auth.js` y `controllers/` | `/`, `/dashboard-medico`, `/portal-paciente` | Pantalla unificada de errores (`403`, `404`, `500`) |

---

## Qué hace cada vista

- **`partials/` (`header.ejs`, `footer.ejs`, `alert.ejs`)**: Evitan duplicar la estructura base del documento HTML, la navegación, el pie de página y las notificaciones entre pantallas. Todas las vistas principales envuelven su contenido con `partials/header` y `partials/footer`.
- **`index.ejs`**: Página de inicio pública que presenta el sistema y enlaza directamente a `/login` y `/registro`.
- **`login.ejs`**: Formulario de acceso con control segmentado para elegir `paciente` o `medico` (`rolDefecto`), correo y contraseña.
- **`registro.ejs`**: Formulario de alta que invoca `cambiarRolRegistro(rol)` (definido en `public/js/main.js`) para mostrar `#campos-paciente` (CURP) o `#campos-medico` (especialidad y cédula).
- **`dashboard-medico.ejs`**: Muestra perfil del médico, 3 métricas (`totalCitasHoy`, `citasPendientes`, `totalExpedientes`), agenda de consultas con acciones (`Atender`, `Confirmar`, `Cancelar`) y directorio buscable de pacientes con enlaces a historial y nueva consulta.
- **`portal-paciente.ejs`**: Muestra los datos del paciente, tabla de sus citas con opción de cancelación y tarjetas con su historial de consultas, diagnósticos y enlace a cada receta imprimible.
- **`nueva-cita.ejs`**: Si el usuario es médico, fija `id_medico` oculto y despliega selector de pacientes (con soporte de `pacientePreseleccionado`); si es paciente, fija `id_paciente` y despliega selector de médicos. Incluye un script en línea para prefijar la fecha mínima en hoy y el valor por defecto en mañana.
- **`nuevo-expediente.ejs`**: Formulario médico que enlaza opcionalmente `id_cita`, precarga paciente y motivo si proviene de una cita, y captura somatometría (`presion_arterial`, `temperatura_c`, `peso_kg`, `talla_cm`), motivo, diagnóstico, receta y notas.
- **`ver-expediente.ejs`**: Presenta la nota médica dentro de `.receta-box` con encabezado médico, datos del paciente, signos vitales, diagnóstico, prescripción, observaciones y firma. Incluye botón `window.print()` y clase `.no-print` para ocultar controles al imprimir.
- **`historial-paciente.ejs`**: Muestra datos de identificación del paciente y el listado cronológico de sus expedientes con acceso a imprimir o crear una nueva nota.
- **`error.ejs`**: Despliega `title` y `mensaje` de fallo y ofrece retorno al inicio o al panel correspondiente si `user` está en sesión.

---

## Comunicación con otras carpetas

```text
controllers/*.js ──► res.render('vista', datos) ──► views/*.ejs + views/partials/*.ejs
middleware/auth.js ──► res.status(403).render('error')         │
                                                               ├──► public/ (CSS, JS, assets)
                                                               └──► routes/*.js (href / form action)
```

- **`controllers/`**: Proveen los datos locales (`user`, `citas`, `expedientes`, `pacientes`, `medicos`, `hoy`, `busqueda`, `mensaje`) al invocar `res.render(...)`.
- **`middleware/`**: `middleware/auth.js` renderiza `error.ejs` directamente cuando bloquea accesos con HTTP `403`.
- **`routes/`**: Las vistas envían navegación y formularios (`GET` / `POST`) directamente hacia los endpoints definidos en `routes/`.
- **`public/`**: Las plantillas dependen de `public/css/style.css` (clases de layout, badges, `.receta-box`, `@media print`) y de `public/js/main.js` (notificaciones flotantes y `cambiarRolRegistro`).
- **`database/`**: Sin acoplamiento directo; solo reciben objetos planos ya consultados por los controladores.