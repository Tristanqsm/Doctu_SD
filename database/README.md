# `database/` — Persistencia y Esquema SQLite

Esta carpeta centraliza la conexión, la definición del esquema relacional y la carga inicial de datos del monolito **Doctu** (`01-monolito`) usando SQLite integrado en Node.js.

---

## Contenido de la carpeta

| Archivo | Origen | Responsabilidad |
| :--- | :--- | :--- |
| `db.js` | Versionado en el repositorio | Crea la conexión síncrona, activa llaves foráneas, define las tablas, siembra datos iniciales y exporta la instancia `db`. |
| `doctu.db` | Generado en tiempo de ejecución | Archivo físico de la base de datos SQLite que almacena todos los registros del sistema. |

---

## Qué hace `db.js`

1. **Conexión y configuración**: Abre `database/doctu.db` mediante `DatabaseSync` del módulo nativo `node:sqlite` y ejecuta `PRAGMA foreign_keys = ON;` para exigir integridad referencial en todas las consultas.
2. **`initDatabase()`**: Se ejecuta automáticamente al importar el archivo. Crea las tablas `usuarios`, `citas` y `expedientes` con `CREATE TABLE IF NOT EXISTS` y valida si `usuarios` está vacía para disparar el sembrado inicial.
3. **`seedInitialData()`**: Inserta datos de demostración una sola vez para que la aplicación sea operable de inmediato:
   - **2 médicos**: `doctor@doctu.com` (Dr. Roberto Muelas) y `elena@doctu.com` (Dra. Elena Ruiz).
   - **3 pacientes**: `paciente@doctu.com`, `maria@doctu.com` y `carlos@doctu.com`.
   - **Contraseña de prueba**: `password123` para todas las cuentas sembradas.
   - **4 citas iniciales**: 2 programadas para hoy y 2 para mañana.
   - **2 expedientes clínicos**: uno asociado a la cita `#1` y otro sin cita vinculada (`null`).
4. **Exportación singleton**: Exporta la instancia `db` (`module.exports = db`) para compartir la misma conexión síncrona en todo el proceso.

---

## Esquema relacional

| Tabla | Campos principales | Reglas y relaciones |
| :--- | :--- | :--- |
| `usuarios` | `id`, `email`, `password`, `rol`, `nombre_completo`, `telefono`, `curp`, `especialidad`, `cedula`, `creado_en` | `email` es `UNIQUE NOT NULL`. `rol` restringido por `CHECK` a `'medico'` o `'paciente'`. |
| `citas` | `id`, `id_paciente`, `id_medico`, `fecha`, `hora`, `motivo`, `estado`, `creado_en` | `id_paciente` e `id_medico` referencian a `usuarios(id)`. `estado` por defecto `'Pendiente'`, restringido a `'Pendiente'`, `'Confirmada'`, `'Atendida'` o `'Cancelada'`. |
| `expedientes` | `id`, `id_paciente`, `id_medico`, `id_cita`, `fecha`, `motivo_consulta`, `peso_kg`, `talla_cm`, `temperatura_c`, `presion_arterial`, `diagnostico`, `tratamiento_receta`, `notas`, `creado_en` | `id_paciente` e `id_medico` referencian a `usuarios(id)`. `id_cita` referencia opcionalmente a `citas(id)`. |

```text
usuarios (medico / paciente)
   ▲           ▲
   │           ├──────────────────────────┐
   │           │                          │
 citas ◄───────┴── expedientes (id_cita opcional)
```

---

## Comunicación con otras carpetas

```text
routes/*.js ──► middleware/auth.js ──► controllers/*.js ──► database/db.js ──► doctu.db
```

- **`controllers/`**: Es la única capa que importa `../database/db`. Los seis controladores ejecutan consultas preparadas (`db.prepare`) directamente sobre la instancia compartida, y `expedienteController.js` utiliza `db.exec` para transacciones explícitas (`BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`).
- **`routes/`, `middleware/`, `views/` y `public/`**: No acceden directamente a `database/`; interactúan con los datos únicamente a través de los controladores y la sesión del usuario.
- **Contenedorización (`Dockerfile` / `docker-compose.yml`)**: Al residir en un archivo local (`doctu.db`), la persistencia entre reinicios del contenedor depende de conservar el archivo en disco o volumen montado.