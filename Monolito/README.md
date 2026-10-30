# DOCTU (Versión Monolito - Prototipo Inicial)

Este proyecto corresponde a la **versión monolítica inicial de Doctu**, diseñada con una arquitectura unificada **MVC (Modelo - Vista - Controlador)**.

A diferencia de la versión distribuida basada en microservicios (ubicada en la carpeta `Doctu`), esta versión representa el **punto de partida / MVP (Producto Mínimo Viable)** del sistema, con interfaces claras, limpias y directas, y sin dependencias externas complejas.

---

## 🏗️ Comparativa de Arquitectura: Monolito vs. Microservicios

| Aspecto | Versión Microservicios (`/Doctu`) | Versión Monolítica (`/Monolito`) |
| :--- | :--- | :--- |
| **Arquitectura** | Frontend desacoplado + Backend API + Docker Compose | Monolito unificado MVC en un solo proceso |
| **Frontend** | React (SPA) con múltiples librerías y bundles | Plantillas EJS renderizadas del lado del servidor (SSR) |
| **Base de Datos** | Supabase PostgreSQL remota / Dockerizada | SQLite local (`database/doctu.db`) con auto-siembra |
| **Infraestructura** | Requiere Docker Compose, Supabase CLI y contenedores | Requiere únicamente Node.js |
| **Autenticación** | Supabase Auth + JWT | Sesiones HTTP nativas del servidor (`express-session`) |
| **Servicios externos** | SendGrid Observer, Pasarela de Pagos Stripe/MP | Sin dependencias de terceros; 100% funcional localmente |

---

## 🎯 Simplificaciones Aplicadas (Enfoque Prototipo Inicial)

Para reflejar un **proyecto recién empezado** y reducir la sobrecarga de mantenimiento, se simplificaron las siguientes funciones:

1. **Expediente Clínico Unificado:**
   - En lugar de tres formatos especializados con alta complejidad (Odontograma con diagrama dental FDI, escalas psicológicas Beck e historias complejas), se implementó un **Formato de Expediente y Consulta Médica Universal** que captura: signos vitales (presión arterial, temperatura, peso, talla), motivo de consulta, diagnóstico clínico y receta/plan de tratamiento con vista imprimible.
2. **Eliminación de la Pasarela de Pagos Compleja:**
   - Se removió la pasarela multi-método (simulación de Stripe y Mercado Pago con tokenización) para enfocarse en el núcleo clínico.
3. **Eliminación del Webhook / Observer de Auditoría SendGrid:**
   - Se prescindió del envío de correos por SendGrid al consultar pacientes, eliminando la necesidad de llaves de API externas.
4. **Interfaces Limpias y Minimalistas:**
   - Diseño directo con estilos CSS organizados, sin sobrecarga de animaciones pesadas ni componentes redundantes.
5. **Autenticación y Sesiones Locales:**
   - Manejo directo de usuarios y sesiones en base de datos local con selector rápido de roles (Médico y Paciente).

---

## 🚀 Cómo Ejecutar el Proyecto

### Requisitos
- **Node.js** (versión 18 o superior recomendada, probado en Node 22/26).
- **npm**

### Pasos de Inicio

1. Abrir una terminal en la carpeta `Monolito`:
   ```bash
   cd Monolito
   ```

2. Instalar dependencias (solo si es la primera vez):
   ```bash
   npm install
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```
   *(También puedes hacer doble clic en `iniciar.bat` en Windows o ejecutar `./iniciar.sh` en Mac/Linux).*

4. Abrir en el navegador:
   ```
   http://localhost:3000
   ```

---

## 🧪 Cuentas de Prueba Precargadas

La base de datos local se inicializa automáticamente con datos de demostración para realizar pruebas inmediatas:

### Perfil Médico
- **Correo:** `doctor@doctu.com`
- **Contraseña:** `password123`
- **Rol:** Médico (Dr. Roberto Muelas - Medicina General)

### Perfil Paciente
- **Correo:** `paciente@doctu.com`
- **Contraseña:** `password123`
- **Rol:** Paciente (Juan Pérez López)

*(Nota: En la pantalla de inicio de sesión dispones de botones para autocompletar estas credenciales con un solo clic).*

---

## 📁 Estructura del Proyecto

```text
Monolito/
├── server.js               # Punto de entrada y servidor Express
├── package.json            # Dependencias del proyecto
├── iniciar.bat             # Script de arranque en Windows
├── iniciar.sh              # Script de arranque en Mac/Linux
├── detener.bat             # Script de apagado
├── database/
│   ├── db.js               # Conexión SQLite, esquemas y sembrado inicial
│   └── doctu.db            # Base de datos SQLite local
├── middleware/
│   └── auth.js             # Middlewares de control de acceso por rol
├── controllers/
│   ├── authController.js   # Lógica de login, registro y logout
│   ├── medicoController.js # Dashboard médico, métricas y pacientes
│   ├── pacienteController.js # Portal de paciente, citas y recetas
│   ├── citaController.js   # Agendamiento y cambio de estados de citas
│   ├── expedienteController.js # Creación y visualización de expedientes
│   └── apiController.js    # Endpoints REST para consulta directa
├── routes/
│   ├── authRoutes.js
│   ├── medicoRoutes.js
│   ├── pacienteRoutes.js
│   ├── citaRoutes.js
│   ├── expedienteRoutes.js
│   └── apiRoutes.js
├── views/                  # Vistas del sistema (EJS)
│   ├── partials/           # Header, footer y alertas
│   ├── index.ejs           # Landing page del prototipo
│   ├── login.ejs           # Pantalla de inicio de sesión
│   ├── registro.ejs        # Registro de usuarios
│   ├── dashboard-medico.ejs# Panel principal del médico
│   ├── portal-paciente.ejs # Panel principal del paciente
│   ├── nuevo-expediente.ejs# Formulario de consulta médica
│   ├── ver-expediente.ejs  # Receta y expediente (imprimible)
│   ├── historial-paciente.ejs # Historial completo por paciente
│   ├── nueva-cita.ejs      # Formulario para agendar cita
│   └── error.ejs           # Manejador de errores (404/500)
└── public/                 # Archivos estáticos
    ├── css/style.css       # Estilos CSS ligeros del prototipo
    ├── js/main.js          # Scripts de utilidad en el cliente
    └── assets/             # Logos e iconos oficiales de Doctu
```

