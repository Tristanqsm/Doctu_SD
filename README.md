# DOCTU — Sistema Distribuido de Historiales Clínicos y Citas Médicas

**Doctu** es una plataforma web distribuida para centralizar historiales clínicos y gestionar citas médicas entre consultorios y hospitales. Reduce la fragmentación de información clínica entre instituciones para mejorar el seguimiento médico y organizar la agenda de consultas desde una sola plataforma.

El proyecto evoluciona de forma incremental por ramas: parte de un monolito MVC en Node.js (`01-monolito`), se desacopla en microservicios con bases aisladas (`02-separacion`) y culmina con réplicas, balanceo de carga activo, consistencia eventual y tolerancia a fallas (`03-resiliencia-y-consistencia`).

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
- **Reporte final del proyecto (PDF):** [`docs/reporte-final.pdf`](docs/reporte-final.pdf)

---

## Estructura de ramas del proyecto

| Rama | Contenido |
| :--- | :--- |
| `main` | Documentación general (`README.md`), especificación (`docs/PRD.md`) y reporte final (`docs/reporte-final.pdf`). |
| `01-monolito` | Primera versión funcional como monolito MVC en Node.js + Express + EJS + SQLite (`node:sqlite`), dockerizado. |
| `02-separacion` | Separación en 3 microservicios (`usuarios`, `agenda`, `expedientes`), API Gateway, JWT *stateless*, bases SQLite aisladas y SPA en Nginx. |
| **`03-resiliencia-y-consistencia`** | **Versión final del prototipo:** 2 réplicas de `expedientes` sobre PostgreSQL 17, balanceador *round-robin* con health check activo/pasivo en el Gateway, Transactional Outbox (`FOR UPDATE SKIP LOCKED`), `Idempotency-Key`, Circuit Breaker, reintentos con *backoff*, modo degradado en la SPA y pruebas automatizadas de falla. |

---

## Cómo levantar el sistema (versión final)

### Requisitos
- **Docker** (Docker Desktop o Docker Engine) con **Docker Compose v2**. No requiere instalar Node.js localmente.

### Ejecución rápida (`03-resiliencia-y-consistencia`)

1. Clonar el repositorio y cambiar a la rama final:
   ```bash
   git clone [https://github.com/Tristanqsm/Doctu_SD.git](https://github.com/Tristanqsm/Doctu_SD.git)
   cd Doctu_SD
   git checkout 03-resiliencia-y-consistencia
   ```

2. Construir y levantar los 7 contenedores:
   ```bash
   docker compose up --build -d
   docker compose ps
   ```

3. Acceder al sistema:
   - **Aplicación web (SPA):** http://localhost:3000
   - **API Gateway:** http://localhost:8080/api
   - **Estado de balanceadores y circuit breakers:** http://localhost:8080/health

Para detener el sistema (o reiniciar datos desde cero agregando `-v`):
```bash
docker compose down
# Reinicio limpio de volúmenes:
docker compose down -v
```

### Pruebas de resiliencia y balanceo

Desde la rama `03-resiliencia-y-consistencia` (en Windows usar **Git Bash**):
```bash
./scripts/demo-balanceo.sh          # reparto round-robin + 4 escenarios de falla
./scripts/demo-balanceo.sh reparto  # solo reparto entre réplicas
```

Las pruebas detalladas de **Transactional Outbox** y **Circuit Breaker** están documentadas en el `README.md` de la rama `03-resiliencia-y-consistencia`.

---

## Cuentas de prueba sembradas

Todas las cuentas de prueba utilizan la contraseña **`password123`**:

| Rol | Correos disponibles |
| :--- | :--- |
| **Médico** | `doctor@doctu.com`, `elena@doctu.com` |
| **Paciente** | `paciente@doctu.com`, `maria@doctu.com`, `carlos@doctu.com` |

---

## Versiones anteriores

Para inspeccionar la evolución histórica, cambia a la rama correspondiente (`git checkout 01-monolito` o `git checkout 02-separacion`) y ejecuta `docker compose up --build -d`.
