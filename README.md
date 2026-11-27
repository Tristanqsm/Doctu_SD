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

## Estructura de carpetas y separación inicial del backend

La descomposición del monolito comenzó extrayendo el tráfico hacia un **API Gateway** y separando primero los dominios de **Usuarios (Autenticación JWT)** y **Agenda**, para después incorporar **Expedientes** y el **Frontend SPA**:

### Raíz del proyecto
- **`docker-compose.yml`**: Orquesta los 5 contenedores (`frontend`, `gateway`, `servicio-usuarios`, `servicio-agenda` y `servicio-expedientes`) dentro de la red *bridge* `doctu_net` (usando el DNS interno de Docker para resolver nombres de servicio) y define los volúmenes aislados (`usuarios_data`, `agenda_data`, `expedientes_data`).

### API Gateway (`gateway/`)
- **`gateway/server.js`**: Punto único de entrada en el puerto `8080` con `express` y `http-proxy-middleware`. Aplica reglas de reescritura (`pathRewrite`) para redirigir `/api/usuarios` → `http://servicio-usuarios:3001`, `/api/agenda` → `http://servicio-agenda:3002` y `/api/expedientes` → `http://servicio-expedientes:3003`. Incluye CORS, `GET /health`, `proxyTimeout` y manejo de errores `502`/`504` en JSON.
- **`gateway/Dockerfile` y `gateway/package.json`**: Definición del contenedor y dependencias del proxy inverso.

### Microservicio de Usuarios y Autenticación (`usuarios/`)
Primer módulo extraído del monolito; eliminó las vistas EJS y las sesiones en memoria (`express-session`) para operar como API REST *stateless* en el puerto interno `3001`:
- **`usuarios/server.js`**: Inicializa la base de datos local y monta las rutas de autenticación y consulta de usuarios en formato JSON.
- **`usuarios/controllers/authController.js` y `usuarios/routes/authRoutes.js`**: Gestionan `POST /login`, `POST /registro` y `POST /logout`. Al validar credenciales correctas, firma y devuelve un **JSON Web Token (JWT)** con `id`, `rol` y `email` del usuario (sin datos sensibles) para autenticar el resto de los microservicios sin sesiones en servidor.
- **`usuarios/controllers/usuarioController.js` y `usuarios/routes/usuarioRoutes.js`**: Exponen `GET /perfil`, `GET /medicos`, `GET /pacientes` y `GET /batch` para que el frontend y otros módulos resuelvan perfiles sin acoplarse a la base de datos.
- **`usuarios/middleware/auth.js`**: Verifica el encabezado `Authorization: Bearer <token>` usando `JWT_SECRET`.
- **`usuarios/database/db.js`**: Administra la base SQLite aislada (`usuarios.db`) y la auto-siembra inicial de médicos y pacientes.

### Microservicio de Agenda (`agenda/`)
Segundo módulo extraído del monolito, desacoplado de las plantillas SSR para operar exclusivamente con JSON en el puerto interno `3002`:
- **`agenda/server.js`**: Arranca el servicio de citas y expone `GET /health`.
- **`agenda/controllers/citaController.js` y `agenda/routes/citaRoutes.js`**: Gestionan la consulta (`GET /citas`, `GET /citas/:id`), creación (`POST /citas`) y actualización de estado (`POST /citas/:id/estado`) de citas médicas (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`).
- **`agenda/middleware/auth.js`**: Valida el token JWT y extrae el usuario autenticado (`req.user`) para filtrar y autorizar acciones según el rol (`medico` o `paciente`).
- **`agenda/database/db.js`**: Administra la base SQLite aislada (`agenda.db`) con la tabla `citas` sin llaves foráneas hacia `usuarios`.

### Microservicio de Expedientes (`expedientes/`)
Tercer módulo del dominio clínico en el puerto interno `3003`:
- **`expedientes/server.js`, `controllers/expedienteController.js` y `routes/expedienteRoutes.js`**: Registran y consultan expedientes clínicos, signos vitales y recetas, comunicándose vía HTTP interno con `servicio-agenda` (`AGENDA_SERVICE_URL`) para marcar citas como `Atendida`.
- **`expedientes/middleware/auth.js` y `database/db.js`**: Validación JWT compartida y base SQLite aislada (`expedientes.db`).

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