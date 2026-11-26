# DOCTU — Arquitectura Distribuida con Microservicios y SPA (`02-separacion`)

Esta rama representa la evolución de **Doctu** desde su prototipo monolítico MVC hacia una **arquitectura distribuida** compuesta por microservicios independientes, un **API Gateway** centralizado, bases de datos SQLite aisladas por dominio (*Database per Service*), autenticación **JWT** sin estado y un **frontend SPA** servido por Nginx.

---

## Auditoría inicial y correcciones realizadas

Durante la auditoría de la separación inicial se detectaron y corrigieron los siguientes puntos críticos antes de conectar la interfaz web:

1. **Aislamiento real de datos (*Database per Service*):**
  - Se eliminó el volumen compartido `doctu_data:/app/database` y la base monolítica `doctu.db` compartida entre contenedores.
  - Se crearon volúmenes y archivos SQLite independientes montados en subcarpetas de datos (`/app/database/data`) para evitar sobrescribir `db.js`:
    - `usuarios_data` → `usuarios.db` (exclusivamente tabla `usuarios`).
    - `agenda_data` → `agenda.db` (exclusivamente tabla `citas`, sin llaves foráneas cruzadas hacia `usuarios`).
    - `expedientes_data` → `expedientes.db` (exclusivamente tabla `expedientes`, sin llaves foráneas cruzadas).
2. **Autenticación y autorización unificada con JWT:**
  - Se eliminó la dependencia residual de `req.session`, redirecciones SSR y `res.render` en las rutas y middlewares del backend.
  - Se configuró `JWT_SECRET` por variable de entorno en `docker-compose.yml` y se implementó validación `Authorization: Bearer <token>` en `usuarios`, `agenda` y `expedientes`.
  - En `agenda`, la identidad del solicitante (`id` y `rol`) se toma exclusivamente del JWT verificado en `req.user` (nunca desde el cuerpo de la petición).
3. **Limpieza de código heredado y nuevos contratos JSON:**
  - Se depuraron archivos residuales del monolito en `usuarios/` (`api*`, `cita*`, `expediente*`, y controladores/rutas SSR antiguos) y se limpiaron los `package.json` eliminando dependencias sin uso (`ejs`, `express-session`).
  - Se añadieron endpoints JSON de consulta (`GET /perfil`, `GET /medicos`, `GET /pacientes?q=`, `GET /batch`, `GET /citas`, `GET /citas/:id`, `GET /expedientes`, `GET /expedientes/paciente/:id`, `GET /expedientes/:id` y `GET /health` en cada servicio).
4. **Extracción del microservicio `expedientes/` (puerto `3003`):**
  - Se creó el servicio `expedientes` con comunicación HTTP interna hacia `servicio-agenda` (`POST /citas/:id/estado`) con timeout y reenvío de token JWT para marcar citas como `Atendida` al registrar un expediente, manteniendo la persistencia clínica incluso si `agenda` no responde de inmediato.
5. **Endurecimiento del API Gateway (`:8080`) y cierre de puertos internos:**
  - Se alinearon dependencias en `gateway/package.json` (`express` + `http-proxy-middleware`), se añadió `GET /health`, `proxyTimeout` y respuestas `502`/`504` en JSON ante fallos de servicios internos.
  - Se retiraron las publicaciones de puertos internos (`3001`, `3002`, `3003`) al host en `docker-compose.yml`, dejando `:8080` (Gateway) y `:3000` (Frontend) como puntos de acceso externos.

---

## Servicios y puertos

| Servicio | Contenedor / Carpeta | Puerto | Responsabilidad |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | `frontend/` (`nginx:alpine`) | `3000` (interno `80`) | Interfaz web SPA (*glassmorphism*, *Dynamic Island*, impresión de recetas) conectada al Gateway. |
| **API Gateway** | `gateway/` | `8080` | Punto único de entrada API (`/api/usuarios`, `/api/agenda`, `/api/expedientes`, `/health`), CORS y manejo de errores. |
| **Servicio de Usuarios** | `usuarios/` | `3001` (interno) | Login/registro con emisión de JWT, perfil, catálogo de médicos, directorio de pacientes y consulta `batch` por IDs. |
| **Servicio de Agenda** | `agenda/` | `3002` (interno) | Gestión de citas médicas filtradas por rol (`medico`/`paciente`), creación y actualización de estados. |
| **Servicio de Expedientes** | `expedientes/` | `3003` (interno) | Registro y consulta de expedientes clínicos, signos vitales, recetas y cierre coordinado de citas en `agenda`. |

---



## Frontend SPA (`frontend/`)

- **`frontend/index.html`**: Contenedor raíz de la SPA (`#navbar-root`, `#app`, `#footer`) y carga de `/js/app.js` y `/css/style.css`.
- **`frontend/js/app.js`**: Enrutamiento por hash (`#/`, `#/login`, `#/registro`, `#/dashboard-medico`, `#/portal-paciente`, `#/citas/nueva`, `#/expedientes/nuevo`, `#/expedientes/:id`, `#/expedientes/paciente/:id`), cliente HTTP hacia `http://localhost:8080/api` con gestión de JWT en `localStorage`, resolución de nombres/perfiles vía `/usuarios/batch` y utilidades de UI/notificaciones.
- **`frontend/js/ui.js` y `frontend/js/api.js`**: Módulos auxiliares de interfaz y comunicación.
- **`frontend/css/style.css` y `frontend/assets/`**: Estilos visuales y recursos gráficos de la aplicación.

---

## Ejecución rápida con Docker Compose

```bash
docker compose up --build -d
docker compose ps
```

- **Aplicación web:** `http://localhost:3000`
- **Healthcheck del Gateway:** `http://localhost:8080/health`

### Credenciales de prueba sembradas
- **Médico:** `doctor@doctu.com` / `password123` (rol `medico`) o `elena@doctu.com` / `password123`
- **Paciente:** `paciente@doctu.com` / `password123` (rol `paciente`), `maria@doctu.com` / `password123` o `carlos@doctu.com` / `password123`