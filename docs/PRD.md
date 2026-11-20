# PRD · DOCTU

Equipo: DOCTU · Integrantes: @Jaramilloooo29, @cortesangel, @Emiliano24246, @Tristanqsm · Fecha: 2026-11-19

## 1. Problema y usuarios

**El problema:** Los historiales clínicos suelen quedar aislados en el archivo físico o sistema interno de cada consultorio u hospital. Cuando un paciente acude a un médico distinto, el profesional carece de antecedentes confiables (diagnósticos previos, alergias, recetas y signos vitales), lo que fragmenta el seguimiento clínico y eleva el riesgo de negligencia médica. Además, muchos consultorios aún llevan su agenda de citas en herramientas separadas o manuales sin vínculo con el expediente.

**Usuarios principales:**
- **Pacientes:** Personas que necesitan centralizar su historial clínico, cargar antecedentes previos, consultar sus recetas, solicitar citas y autorizar qué médicos pueden ver su información.
- **Médicos:** Profesionales de la salud que organizan su agenda de consultas, atienden citas, registran nuevos expedientes/recetas y consultan el historial completo de un paciente previa autorización.

## 2. Por qué es un sistema distribuido

Doctu justifica una arquitectura distribuida por tres razones técnicas y de negocio:
1. **Patrones de carga distintos por dominio:** La consulta y lectura de historiales clínicos (especialmente al crecer con múltiples consultorios y documentos) tiene una carga de lectura intensiva y distinta al agendamiento transaccional de citas o a la autenticación. Separarlos permite escalar horizontalmente solo el servicio con mayor demanda.
2. **Aislamiento de fallas y disponibilidad parcial:** Si el servicio de agenda de citas falla o entra en mantenimiento, los médicos deben seguir pudiendo consultar historiales clínicos críticos durante una urgencia, y viceversa.
3. **Separación de propiedad y privacidad de datos:** Los datos de identidad/consentimiento, la agenda de citas y el expediente clínico tienen requisitos distintos de acceso, auditoría y crecimiento, por lo que aislar sus bases de datos evita un punto único de acoplamiento y prepara la interoperabilidad entre consultorios.

## 3. Objetivos y lo que no vamos a hacer

**Objetivos (alcance central):**
1. **Identidad y consentimiento de acceso:** Registro e inicio de sesión diferenciados por rol (`paciente` y `medico`), con control de acceso explícito para que un médico consulte el historial clínico solo con autorización del paciente.
2. **Gestión y organización de citas médicas:** Creación, consulta y cambio de estado de citas (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`) tanto para la agenda del médico como para el portal del paciente.
3. **Historial y expediente clínico digital:** Registro estructurado de consultas médicas (signos vitales, motivo, diagnóstico, receta imprimible y notas) y carga de antecedentes clínicos por parte del paciente para consulta unificada.
4. **Evolución controlada:** Partir de un monolito funcional verificable (`01-monolito`) y migrar incrementalmente hacia servicios independientes con gateway, balanceo, manejo de fallas y consistencia controlada.

**Lo que NO vamos a hacer:**
- Videoconsultas, chat en tiempo real ni telemedicina.
- Procesamiento de pagos, facturación electrónica ni integración con aseguradoras.
- Integración real con estándares hospitalarios externos (HL7/FHIR) ni firma electrónica avanzada (e.firma/SAT).
- Aplicaciones móviles nativas (solo interfaz web responsiva).
- Diagnóstico automatizado con IA o alertas clínicas predictivas.

## 4. El requisito que perseguimos y lo que dejamos atrás

- **Requisito prioritario:** **Integridad, privacidad y consistencia de datos clínicos y de citas** (no perder expedientes, no filtrar historiales sin consentimiento y no dejar citas duplicadas o con estados corruptos), manteniendo **disponibilidad degradada** entre módulos independientes.
- **Lo que dejamos atrás (sacrificios conscientes):**
  - Sacrificamos **consistencia inmediata global** entre servicios al salir del monolito: cuando se registra un expediente ligado a una cita, la actualización del estado de la cita pasa a ser **consistencia eventual** mediante eventos/sagas en lugar de una transacción ACID única.
  - Sacrificamos **latencia mínima absoluta** en vistas compuestas al sustituir `JOIN` locales de SQLite por llamadas de red a través de un gateway, y aceptamos mayor complejidad operativa (múltiples contenedores y monitoreo) a cambio de aislamiento y escalabilidad independiente.

## 5. Historias de usuario

### Épica 1: Identidad y Consentimiento Clínico
- **HU-01 (Registro y acceso por rol):** Como usuario (paciente o médico), quiero registrarme e iniciar sesión con mi rol correspondiente para acceder únicamente a las herramientas autorizadas para mi perfil.
  - **Criterios de aceptación:**
    - El sistema impide registrar correos electrónicos duplicados.
    - Un paciente solo puede acceder a `/portal-paciente` y recibe HTTP `403` si intenta entrar a rutas exclusivas de médico (`/dashboard-medico`, `/expedientes/nuevo`).
    - Un médico solo puede acceder a `/dashboard-medico` y recibe HTTP `403` en rutas exclusivas de paciente.
    - Las peticiones sin sesión/token válido son rechazadas o redirigidas a `/login`.
- **HU-02 (Consentimiento de consulta de historial):** Como paciente, quiero otorgar o revocar permiso a un médico específico para consultar mi historial clínico y así proteger la privacidad de mis datos entre distintos consultorios.
  - **Criterios de aceptación:**
    - Un paciente nunca puede visualizar expedientes de otro paciente (HTTP `403`).
    - Un médico solo puede abrir el historial completo de un paciente si existe un consentimiento activo otorgado por el paciente (o una cita activa aprobada según la política definida).
    - Al revocar el consentimiento, el médico pierde acceso inmediato en consultas posteriores.

### Épica 2: Organización de Citas Médicas
- **HU-03 (Agendar cita):** Como paciente o médico, quiero agendar una cita indicando médico, paciente, fecha, hora y motivo para mantener organizada la agenda de consultas.
  - **Criterios de aceptación:**
    - Todos los campos obligatorios (paciente, médico, fecha, hora y motivo) se validan antes de persistir.
    - Al agendar como paciente, el sistema fuerza su propio `id_paciente`; al agendar como médico, asigna su propio `id_medico` por defecto.
    - La cita queda visible inmediatamente en la agenda del médico y en el portal del paciente.
- **HU-04 (Gestión de estados de cita):** Como médico o paciente, quiero actualizar el estado de una cita (`Confirmada`, `Atendida`, `Cancelada`) para reflejar su situación real en la agenda.
  - **Criterios de aceptación:**
    - Solo se aceptan estados válidos (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`); cualquier otro valor responde HTTP `400`.
    - Al registrar un expediente vinculado a una cita, dicha cita pasa automáticamente a estado `Atendida`.
    - Una solicitud repetida con la misma llave de idempotencia no genera citas duplicadas.

### Épica 3: Historial y Expediente Clínico
- **HU-05 (Registro e impresión de expediente médico):** Como médico, quiero registrar los signos vitales, diagnóstico, tratamiento y observaciones de una consulta para generar una nota médica imprimible en el historial del paciente.
  - **Criterios de aceptación:**
    - Motivo, diagnóstico, tratamiento y paciente son obligatorios; los signos vitales (presión, temperatura, peso, talla) son opcionales.
    - El expediente queda ligado al médico tratante y opcionalmente a la cita atendida.
    - Tanto el médico como el paciente dueño del expediente pueden abrir la vista imprimible (`/expedientes/:id`).
- **HU-06 (Carga de historial previo por el paciente):** Como paciente, quiero subir o registrar antecedentes de mi historial clínico previo (estudios, diagnósticos o documentos externos) para que mis nuevos médicos cuenten con contexto completo.
  - **Criterios de aceptación:**
    - El paciente autenticado puede adjuntar o registrar antecedentes clínicos asociados exclusivamente a su `id_paciente`.
    - Los antecedentes aparecen ordenados cronológicamente junto a las notas creadas por médicos y respetan las mismas reglas de consentimiento.

## 6. Del monolito a los servicios

**Módulos en el monolito inicial (`01-monolito`):**
Un solo proceso Node.js + Express (`server.js`) con vistas EJS y una única base SQLite (`database/doctu.db`) dividido en 6 módulos espejo (`routes/` ↔ `controllers/`): `auth`, `medico`, `paciente`, `cita`, `expediente` y `api`.

**Servicios resultantes (3 servicios de dominio + 1 puerta de entrada):**

| Servicio | Responsabilidad | Dueño de datos | Llamadas que cruzan la red |
| :--- | :--- | :--- | :--- |
| **API Gateway / BFF** | Única puerta de entrada, validación de sesión/JWT, enrutamiento y composición de vistas (`dashboard-medico`, `portal-paciente`) | Ninguno (sin estado persistente) | Llama por HTTP interno a Usuarios, Citas y Expedientes |
| **Servicio de Usuarios y Consentimientos** | Registro, autenticación, perfiles de médicos/pacientes y matriz de consentimiento paciente→médico | Base propia: `usuarios`, `consentimientos` | Recibe validaciones de identidad/consentimiento desde el Gateway o servicios |
| **Servicio de Citas** | Creación, consulta, agenda por médico/paciente y ciclo de estados de citas | Base propia: `citas` (referencia lógica a `id_paciente` e `id_medico`) | Recibe creación/consultas desde el Gateway y consume evento `ExpedienteCreado` |
| **Servicio de Expedientes** | Registro de notas médicas, signos vitales, recetas y antecedentes cargados por el paciente | Base propia: `expedientes`, `antecedentes_paciente` | Verifica consentimiento con Usuarios y emite evento `ExpedienteCreado` hacia Citas |

**Plan de ramas:**
1. `main`: `README.md` general y `docs/PRD.md`.
2. `01-monolito`: Aplicación monolítica MVC funcional, transacción ACID local y `docker-compose.yml` único.
3. `02-separacion`: División en los 3 servicios de dominio con bases aisladas y API Gateway en Docker Compose.
4. `03-resiliencia-y-consistencia`: Balanceo con réplicas, sagas/eventos para expediente→cita, timeouts, reintentos, *circuit breaker* e idempotencia.

## 7. Dónde vive cada pieza

| Pieza | Dónde vive | Por qué | Qué pasa si falla |
|---|---|---|---|
| **API gateway** | Contenedor dedicado (`api-gateway` en Express/Nginx) expuesto en el puerto público (`3000` / `8080`). Expone `/login`, `/registro`, `/api/usuarios/*`, `/api/citas/*`, `/api/expedientes/*` y `/health`. | Oculta la topología interna, centraliza autenticación, CORS/sesiones y evita que el cliente conozca puertos internos de cada servicio. | Es punto único de entrada; si cae, el tráfico externo no llega a los servicios. Se mitiga con reinicio automático (`restart: unless-stopped`), `/health` y posibilidad de replicarlo tras un balanceador externo. |
| **Directorio / DNS** | DNS interno de la red bridge de Docker Compose (`usuarios-service`, `citas-service`, `expedientes-service`). | Elimina IPs fijas (*hardcoded*), funciona nativamente en Docker Compose y resuelve nombres de servicio hacia los contenedores activos sin infraestructura extra. | Si falla la resolución de nombres en Docker, los servicios no se encuentran; al ser gestionado por el daemon de Docker, si un contenedor cambia de IP o reinicia, el DNS actualiza automáticamente el destino. |
| **Balanceo** | En Nginx / API Gateway mediante *round-robin* (apoyado por el DNS interno de Docker Compose) frente a múltiples réplicas (`replicas: 2+`) del servicio de **Expedientes** (y/o **Citas**). | Las consultas de historiales médicos y agendas concentran la mayoría del tráfico de lectura; repartir entre réplicas evita cuellos de botella en un solo proceso de Node.js. | Si una réplica cae, el *healthcheck* la retira de la rotación y las peticiones siguen atendiéndose en las réplicas sanas con degradación mínima. |
| **Datos (tipo de base, réplicas, particiones)** | Patrón *Database per Service*: cada servicio tiene su propia base de datos en volumen Docker independiente (`usuarios_db`, `citas_db`, `expedientes_db`), partiendo de SQLite en `01-monolito` y migrando a motores cliente-servidor (PostgreSQL) al habilitar réplicas. Sin llaves foráneas entre bases. | Evita acoplamiento por esquema compartido y permite escalar o respaldar cada dominio por separado. Si el volumen de historiales crece, `expedientes_db` se particiona (*sharding*) usando `id_paciente` como llave para mantener todo el historial de un paciente en el mismo shard. | Si cae `citas_db`, solo falla el módulo de citas; los médicos siguen consultando expedientes en `expedientes_db`. Respaldos por servicio y réplicas de lectura reducen el impacto ante caídas. |
| **Operaciones entre servicios** | En `01-monolito` vive en una transacción SQL local (`expedienteController.postNuevoExpediente`). Al separar servicios, vive como **Saga coreografiada con patrón Outbox** entre **Expedientes** y **Citas**: Expedientes guarda el registro y publica `ExpedienteCreado`; Citas consume el evento y marca la cita como `Atendida`. | Al no existir transacciones ACID entre bases distintas, desacoplar por eventos evita bloqueos distribuidos (2PC) y garantiza que el expediente clínico nunca se pierda si Citas tarda en responder. | Si Citas está caído cuando se guarda un expediente, el evento permanece pendiente y se reintenta hasta que Citas se recupere (consistencia eventual). Mientras tanto, el expediente ya es visible y la cita se actualiza al reanudarse Citas. |
| **Manejo de fallas** | En los clientes HTTP internos del Gateway y entre servicios: **timeouts** cortos (2–3 s), **reintentos con backoff exponencial** solo para errores transitorios en operaciones idempotentes, **circuit breaker** para cortar llamadas a servicios caídos y **llaves de idempotencia** (`Idempotency-Key`) al crear citas o expedientes. | Evita que un servicio lento bloquee todos los hilos del Gateway (falla en cascada) y previene citas o recetas duplicadas cuando un cliente o servicio reintenta tras un timeout. | Si un servicio excede el umbral de fallos, el *circuit breaker* se abre y responde rápido con error controlado o vista degradada (por ejemplo, mostrar el portal sin agenda pero con historial) hasta que el servicio pase pruebas en estado semiabierto. |

## 8. Stack y cómo se levanta

- **Runtime y Backend:** **Node.js 22 (`node:22-alpine`) + Express 4** — Lenguaje unificado para todo el equipo, ligero en contenedores y con soporte nativo para `node:sqlite` en la etapa monolítica.
- **Presentación:** **EJS (SSR)** + CSS/JS nativos en `01-monolito` — Evita sobrecarga de compilación en el prototipo inicial; permite migrar a BFF o SPA sin reescribir la lógica de dominio.
- **Persistencia:** **SQLite (`node:sqlite`)** en `01-monolito` por cero configuración externa; evolución planificada a **PostgreSQL** por servicio en ramas distribuidas para soportar concurrencia y réplicas.
- **Contenedorización y levantamiento:** **Docker + Docker Compose** (`Dockerfile` y `docker-compose.yml` en cada rama de código). Se levanta con un único comando (`docker compose up --build -d`) para garantizar reproducibilidad en cualquier equipo.

## 9. Decisiones de arquitectura

- **Iniciar con un monolito MVC en lugar de microservicios desde el día 1** | *Descartado:* Crear 4 microservicios desde el inicio | *Por qué:* Permite validar el flujo completo del negocio, tener una línea base con transacciones ACID reales y evidenciar qué acoplamientos (`JOIN`, sesiones en memoria, transacciones multi-tabla) se rompen al distribuir.
- **Partir el sistema en 3 servicios de dominio (Usuarios/Consentimiento, Citas, Expedientes)** | *Descartado:* Separar Médicos, Pacientes, Recetas, Signos Vitales y Notificaciones en 6+ servicios | *Por qué:* Mantiene fronteras claras por dueño de dato, evita chatiness excesivo por red y es operable por un equipo de 4 personas.
- **Usar Sagas / eventos para cerrar la cita al crear expediente** | *Descartado:* Transacción distribuida 2PC | *Por qué:* 2PC bloquea recursos ante caídas de red y acopla la disponibilidad del expediente clínico a la disponibilidad de la agenda.
- **Controlar acceso al historial mediante consentimiento explícito paciente→médico** | *Descartado:* Dejar todo historial público para cualquier médico registrado | *Por qué:* Responde directamente al problema de privacidad médica y evita exposición indebida de datos sensibles entre consultorios.
- **Migrar sesiones en memoria (`express-session`) a JWT o Redis en microservicios** | *Descartado:* Mantener memoria local por contenedor | *Por qué:* Con múltiples réplicas o servicios, una sesión en la RAM de un contenedor no es visible desde los demás.

## 10. Preguntas abiertas y desacuerdos

1. **Carga de historial clínico por el paciente (`HU-06`):** En `01-monolito` únicamente los médicos crean expedientes estructurados. Queda por definir si en `02-separacion` el paciente subirá archivos PDF/imágenes (almacenamiento de objetos/volumen compartido) o solo registros de texto estructurado de antecedentes.
2. **Granularidad del consentimiento (`HU-02`):** En `01-monolito` cualquier médico autenticado puede buscar pacientes y abrir `/expedientes/paciente/:id`. El equipo debe acordar si el consentimiento será permanente por médico, temporal con expiración o vinculado automáticamente a una cita aceptada.
3. **Motor de base de datos y mensajería en `02-separacion` / `03-...`:** Confirmar entre los cuatro si las bases separadas usarán PostgreSQL (recomendado para réplicas) o SQLite aislado por contenedor, y si los eventos entre Expedientes y Citas viajarán por RabbitMQ/Redis Streams o mediante tabla *outbox* + polling HTTP.
4. **Renombrado del repositorio y distribución de commits:** Confirmar con el equipo el renombrado del repo a `sd-2027-1-doctu` (minúsculas y guiones según lineamientos) y validar los commits de `@Emiliano24246` antes de limpiar ramas antiguas.