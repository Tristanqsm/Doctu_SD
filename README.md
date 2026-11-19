# DOCTU — Arquitectura Monolítica (`01-monolito`)

Sistema web de gestión médica, citas y expedientes clínicos implementado como un **monolito MVC** en un único proceso de Node.js + Express, vistas EJS (SSR) y base de datos SQLite integrada (`node:sqlite`).

Esta rama representa la línea base funcional del proyecto antes de su descomposición en microservicios.

---

## Arquitectura general

Todo el sistema corre dentro de un solo proceso (`server.js`) con una única base de datos compartida (`database/doctu.db`):

```text
Navegador / Cliente HTTP
          │
          ▼
      server.js (Express, sesiones 24h, res.locals, 404/500)
          │
          ├──► public/            (Archivos estáticos: CSS, JS, imágenes)
          ├──► GET /              (Landing index.ejs o redirección por rol)
          ├──► routes/*.js        (Rutas web en / y JSON en /api)
          │         │
          │         ▼
          │   middleware/auth.js  (Sesión y control de roles)
          │         │
          │         ▼
          │   controllers/*.js    (Lógica de negocio)
          │         │
          │         ├──► database/db.js ──► database/doctu.db (SQLite ACID)
          │         └──► views/*.ejs + views/partials/*.ejs (HTML SSR)
```

---

## Estructura y documentación por módulo

Cada carpeta principal cuenta con su propio `README.md` detallando archivos, flujo interno y relación con el resto del monolito:

| Ruta | Responsabilidad | Documentación |
| :--- | :--- | :--- |
| `server.js` | Punto de entrada: inicializa SQLite, Express, EJS, sesiones, rutas y manejo de errores `404`/`500` | En este archivo |
| `controllers/` | Lógica de negocio, validaciones, consultas SQL y transacciones ACID | [`controllers/README.md`](controllers/README.md) |
| `database/` | Conexión `node:sqlite`, esquema relacional (`usuarios`, `citas`, `expedientes`) y sembrado inicial | [`database/README.md`](database/README.md) |
| `middleware/` | Protección de rutas por sesión y rol (`requireAuth`, `requireMedico`, `requirePaciente`) | [`middleware/README.md`](middleware/README.md) |
| `routes/` | Enrutadores HTTP espejados 1 a 1 con `controllers/` | [`routes/README.md`](routes/README.md) |
| `views/` | Plantillas EJS y parciales reutilizables (`header`, `footer`, `alert`) | [`views/README.md`](views/README.md) |
| `public/` | Recursos estáticos (`style.css`, `main.js`, `Logo.png`, `Icon.png`) | [`public/README.md`](public/README.md) |

### Archivos de configuración y operación en la raíz

| Archivo | Función |
| :--- | :--- |
| `package.json` | Define dependencias (`express`, `ejs`, `express-session`) y scripts (`npm start`, `npm run dev`). |
| `Dockerfile` | Construye la imagen sobre `node:22-alpine`, expone el puerto `3000` y ejecuta `node --no-warnings server.js`. |
| `docker-compose.yml` | Orquesta el contenedor `doctu-monolito` en el puerto `3000` con volumen persistente `doctu_data` en `/app/database`. |
| `iniciar.sh` / `iniciar.bat` / `detener.bat` | Scripts de apoyo para arrancar y detener el entorno rápidamente. |

---

## Superficie de rutas principales

### Interfaz Web (SSR)
- `GET /` — Portada pública o redirección automática al panel del rol en sesión.
- `GET / POST /login`, `GET / POST /registro`, `GET /logout` — Autenticación y cierre de sesión.
- `GET /dashboard-medico` — Panel del médico (métricas, agenda y búsqueda de pacientes).
- `GET /portal-paciente` — Portal del paciente (citas activas e historial clínico).
- `GET / POST /citas/nueva`, `POST /citas/:id/estado` — Agendamiento y cambio de estado de citas.
- `GET / POST /expedientes/nuevo`, `GET /expedientes/:id`, `GET /expedientes/paciente/:id` — Registro, impresión e historial de expedientes clínicos.

### API JSON (`/api`)
- `GET /api/health` — Estado y versión del monolito.
- `GET /api/pacientes` — Listado de pacientes (sin contraseñas).
- `GET /api/citas` — Listado de citas con nombres de paciente y médico.
- `GET /api/expedientes` — Listado de expedientes ordenados por fecha descendente.

---

## Ejecución del proyecto

### Opción 1: Con Docker (recomendada)

Requiere **Docker** y **Docker Compose**:

```bash
docker compose up --build -d
```

Abrir en el navegador: [http://localhost:3000](http://localhost:3000)

Para detener el contenedor:

```bash
docker compose down
```

> Si modificas `database/db.js` y necesitas reiniciar la base de datos dentro del volumen persistente, ejecuta `docker compose down -v` antes de volver a levantar.

### Opción 2: Ejecución local sin Docker

Requiere **Node.js 22 o superior** (por el uso del módulo nativo `node:sqlite`):

```bash
npm install
npm start
```

Para desarrollo con recarga automática:

```bash
npm run dev
```

---

## Cuentas de prueba precargadas

Si la tabla `usuarios` está vacía al arrancar, `database/db.js` siembra automáticamente usuarios, citas y expedientes de prueba (contraseña común: `password123`):

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Médico** | `doctor@doctu.com` | `password123` |
| **Médico** | `elena@doctu.com` | `password123` |
| **Paciente** | `paciente@doctu.com` | `password123` |
| **Paciente** | `maria@doctu.com` | `password123` |
| **Paciente** | `carlos@doctu.com` | `password123` |

---

## Justificación del monolito y transición a microservicios

Este prototipo aprovecha deliberadamente las propiedades del monolito para establecer una base clara y comparable con las siguientes etapas distribuidas:

| Aspecto | En el monolito actual (`01-monolito`) | Al migrar a microservicios |
| :--- | :--- | :--- |
| **Despliegue** | Un solo contenedor `node:22-alpine` | Múltiples contenedores independientes detrás de un Gateway |
| **Persistencia** | Base única SQLite (`doctu.db`) con llaves foráneas y `JOIN` locales | Base de datos por servicio (`usuarios`, `citas`, `expedientes`) |
| **Consistencia** | Transacción ACID local al crear expediente y marcar cita como `'Atendida'` | Consistencia eventual con **Sagas** o eventos (*outbox*) |
| **Sesiones** | `express-session` en memoria local de un solo proceso | Sesiones compartidas (Redis) o tokens sin estado (JWT) |
| **Presentación** | Vistas EJS acopladas al servidor (SSR) | BFF o frontend desacoplado consumiendo APIs JSON |
| **Seguridad a reforzar** | Contraseñas en texto plano en prototipo y endpoints `/api/*` abiertos | Hashing de contraseñas, protección de `/api/*` y validación de propiedad en citas |