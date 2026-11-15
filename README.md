# DOCTU (Versión Monolito - Prototipo Inicial)

Este proyecto corresponde a la **versión monolítica inicial de Doctu**, diseñada con una arquitectura unificada **MVC (Modelo - Vista - Controlador)** en un único proceso de Node.js.

A diferencia de la versión distribuida basada en microservicios, esta versión representa el **punto de partida / MVP (Producto Mínimo Viable)** del sistema, con interfaces claras y una única base de datos centralizada.

---

## 🏗️ Comparativa de Arquitectura: Monolito vs. Microservicios

| Aspecto | Versión Microservicios (Próximamente) | Versión Monolítica (Actual) |
| :--- | :--- | :--- |
| **Arquitectura** | Frontend desacoplado + Backend API + Múltiples contenedores | Monolito unificado MVC en un solo proceso |
| **Frontend** | React (SPA) u otro framework moderno | Plantillas EJS renderizadas del lado del servidor (SSR) |
| **Base de Datos** | Múltiples bases de datos (una por servicio) | **SQLite local (`database/doctu.db`) con auto-siembra** |
| **Infraestructura** | Gateway, Directorio, Balanceador, Docker Compose | **Solo Docker Compose con un servicio Node.js** |
| **Transacciones** | Sagas / Transacciones distribuidas | **Transacciones locales SQL (ACID) (`BEGIN` / `COMMIT`)** |

---

## ✅ Estado Actual: Listo para Distribuir

El monolito ha sido refactorizado y asegurado para cumplir con todos los requerimientos antes de su separación:

1. **Rutas Core Habilitadas:** Las funciones principales de negocio (Agendar Citas y Crear Expedientes) están 100% operativas de punta a punta.
2. **Transacciones Locales (ACID):** La creación de un expediente y la actualización simultánea de la cita correspondiente se ejecutan bajo una misma transacción SQL. Esto demuestra la naturaleza "Todo o Nada" del monolito, la cual sacrificaremos intencionalmente al migrar a microservicios.
3. **Frontend Integrado:** Las vistas EJS interactúan directamente con los controladores, eliminando alertas de "Próximamente" y permitiendo el flujo natural del usuario.
4. **Entorno Dockerizado:** El monolito corre bajo `node:22-alpine` con su propio `docker-compose.yml`, garantizando que cualquier miembro del equipo (o el evaluador) pueda levantarlo sin dependencias locales.

---

## ¿Cómo Ejecutar el Proyecto?

### Requisitos
- **Docker y Docker Compose** instalados.

### Pasos de Inicio

1. Abrir una terminal en esta carpeta.
2. Levantar el contenedor:
   ```bash
   docker compose up --build -d
   ```
3. Abrir en el navegador:
   [http://localhost:3000](http://localhost:3000)

---

## Cuentas de Prueba Precargadas

La base de datos local se inicializa automáticamente con datos de demostración:

### Perfil Médico
- **Correo:** `doctor@doctu.com`
- **Contraseña:** `password123`
- **Rol:** Médico

### Perfil Paciente
- **Correo:** `paciente@doctu.com`
- **Contraseña:** `password123`
- **Rol:** Paciente

---

## 📁 Estructura del Proyecto

```text
.
├── server.js              # Punto de entrada y servidor Express
├── package.json           # Dependencias (Express, EJS, express-session)
├── Dockerfile             # Configuración de imagen Node.js
├── docker-compose.yml     # Orquestación del contenedor único
├── database/
│   ├── db.js              # Conexión SQLite, esquemas y sembrado
│   └── doctu.db           # Base de datos única
├── middleware/            # Control de acceso y sesiones
├── controllers/           # Lógica de negocio (MVC)
├── routes/                # Definición de endpoints
├── views/                 # Vistas EJS (Frontend SSR)
└── public/                # Archivos estáticos (CSS, JS, Assets)
```