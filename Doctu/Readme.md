# DOCTU · Sistema Distribuido 

Proyecto de migración de Monolito a Arquitectura de Microservicios Node.js/Docker.

## Clonar y levantar

Para ejecutar esta versión necesitas tener instalado **Docker** y **Docker Compose** en tu equipo. No necesitas tener Node.js instalado localmente, ya que todo se construye y ejecuta dentro de los contenedores.

Asegúrate de estar posicionado en la raíz de la carpeta `Doctu` y ejecuta:

```bash
# Levantar la infraestructura en segundo plano
docker compose up --build -d

# Verificar el estado de los contenedores
docker compose ps
```

## Qué funciona y cómo comprobarlo

Actualmente, el esqueleto del sistema distribuido está activo. Contamos con dos servicios contenedorizados funcionando en la red interna de Docker (`doctu_red`):
1. **API Gateway (`gateway`)**: Escuchando en el puerto externo `3000`.
2. **Servicio de Autenticación (`auth`)**: Microservicio extraído del monolito, escuchando internamente en el puerto `3001`.

Puedes comprobar que el enrutamiento y la base de datos funcionan enviando una petición simulada (login) directamente al Gateway. Este interceptará el prefijo `/api/auth` y lo dirigirá al microservicio correspondiente:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "doctor@doctu.com", "password": "password123", "rol": "medico"}'
```

**Respuesta esperada:** Un JSON con estatus HTTP 200 detallando el `Login exitoso` y devolviendo los datos del usuario. 

## Qué queda fuera (Trabajo Pendiente)

Esta es una versión en transición inicial. Las siguientes características aún **no** están implementadas en esta carpeta:
* **Microservicios restantes:** Los dominios de `pacientes`, `medicos`, `citas` y `expedientes` aún residen en el monolito y deben ser extraídos en carpetas independientes.
* **Base de datos compartida:** `auth` está usando un archivo `.db` de SQLite embebido. A futuro, migraremos a Supabase (PostgreSQL).

## Estructura actual

```text
Doctu/
├── docker-compose.yml     # Orquestador de servicios
├── README.md              
├── gateway/               # Punto de entrada (Puerto 3000)
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
└── auth/                  # Microservicio de Autenticación (Puerto 3001)
    ├── controllers/
    ├── database/
    ├── routes/
    ├── server.js         
    ├── Dockerfile
    └── package.json
```

## Cerrar el entorno

Para detener y eliminar los contenedores generados, ejecuta:

```bash
docker compose down
```