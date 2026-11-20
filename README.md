# DOCTU — Sistema Distribuido de Historiales Clínicos y Citas Médicas

**Doctu** es una plataforma web para centralizar historiales clínicos y gestionar citas médicas entre consultorios y hospitales. Busca reducir la fragmentación de información entre instituciones para dar mejor seguimiento clínico y disminuir riesgos de negligencia médica, permitiendo que los pacientes controlen el acceso a su historial mediante consentimiento y que los médicos organicen su agenda de consultas.

El proyecto evoluciona de forma incremental por ramas, iniciando como un monolito MVC en Node.js y descomponiéndose progresivamente en servicios distribuidos contenedorizados con Docker Compose.

---

## Equipo DOCTU

| Integrante | Usuario de GitHub |
| :--- | :--- |
| Rodríguez Jaramillo Alejandro | [@Jaramilloooo29](https://github.com/Jaramilloooo29) |
| Cortés Bolaños Angel David | [@cortesangel](https://github.com/cortesangel) |
| Salgado Cruz Emiliano Roman | [@Emiliano24246](https://github.com/Emiliano24246) |
| Sanchez Mayen Tristan Qesen | [@Tristanqsm](https://github.com/Tristanqsm) |

---

## Documentación principal

- **Documento de Requerimientos del Producto (PRD):** [`docs/PRD.md`](docs/PRD.md)

---

## Estructura de ramas del proyecto

| Rama | Contenido |
| :--- | :--- |
| `main` | Documentación base del proyecto (`README.md`) y especificación funcional/arquitectónica (`docs/PRD.md`). |
| `01-monolito` | Primera versión funcional del sistema como monolito MVC en Node.js + Express + EJS + SQLite (`node:sqlite`), dockerizado y documentado por módulo. |
| `02-separacion` | Evolución hacia servicios desacoplados con base de datos independiente y comunicación entre contenedores. |

---

## Cómo levantar el sistema

El código ejecutable vive en las ramas de versión (`01-monolito`, `02-separacion`, etc.).

### Requisitos
- **Docker** y **Docker Compose** (recomendado), o **Node.js 22+** para ejecución local.

### Ejecución de la versión monolítica (`01-monolito`)

1. Clonar el repositorio y cambiar a la rama `01-monolito`:
   ```bash
   git clone [https://github.com/Tristanqsm/Doctu_SD.git](https://github.com/Tristanqsm/Doctu_SD.git)
   cd Doctu_SD
   git checkout 01-monolito
   ```
2. Levantar el contenedor con Docker Compose:
   ```bash
   docker compose up --build -d
   ```
3. Abrir en el navegador: [http://localhost:3000](http://localhost:3000)

Para detener el sistema:
```bash
docker compose down
```

### Cuentas de prueba precargadas (`01-monolito`)

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Médico** | `doctor@doctu.com` | `password123` |
| **Paciente** | `paciente@doctu.com` | `password123` |