# `public/` — Recursos Estáticos y Capa Cliente

Esta carpeta almacena los archivos estáticos que Express sirve directamente al navegador en el monolito **Doctu** (`01-monolito`): identidad gráfica, estilos globales y scripts ligeros de interacción del lado del cliente.

---

## Estructura de la carpeta

| Ruta | Tipo | Responsabilidad |
| :--- | :--- | :--- |
| `assets/Icon.png` | Imagen | Ícono de la aplicación (favicon / marca compacta). |
| `assets/Logo.png` | Imagen | Logotipo principal de Doctu para vistas y encabezados. |
| `css/style.css` | CSS | Sistema de diseño global, responsive y reglas de impresión clínica. |
| `js/main.js` | JavaScript (cliente) | Efectos visuales, notificaciones flotantes y lógica dinámica del formulario de registro. |

---

## Qué hace cada archivo

### `assets/Icon.png` y `assets/Logo.png`
Recursos gráficos estáticos referenciados desde las plantillas EJS para mantener una identidad visual uniforme en encabezados, páginas de acceso y documentos clínicos.

### `css/style.css`
Concentra todo el diseño visual del monolito en una sola hoja de estilos sin preprocesadores ni frameworks externos:
- **Tipografía y variables (`:root`)**: Importa `Plus Jakarta Sans` y `JetBrains Mono` desde Google Fonts y define tokens de color, transparencias (*glassmorphism*), radios y curvas de animación.
- **Fondo y navegación**: Estiliza el lienzo animado (`.liquid-canvas`, `.liquid-orb`) y la barra superior flotante fija (`.navbar-wrapper`, `.navbar`, `.user-badge`).
- **Componentes de negocio**: Define tarjetas (`.card`, `.stat-card`), tablas (`.table`, resaltado `.cita-hoy`), botones, controles segmentados (`.segmented-control`) y etiquetas de estado de cita (`.badge-confirmada`, `.badge-pendiente`, `.badge-atendida`, `.badge-cancelada`).
- **Notificaciones (*Dynamic Island*)**: Estilos y animación (`dynamicIslandExpand`) para `.alert-container` y `.alert` (`alert-success`, `alert-danger`, `alert-info`).
- **Formato clínico e impresión**: Clases `.receta-box`, `.receta-header`, `.receta-vitals` y `.receta-firma` junto con `@media print`, que oculta navegación, botones, alertas y fondo para imprimir expedientes limpios.
- **Adaptabilidad**: Regla `@media (max-width: 900px)` para colapsar grillas y habilitar desplazamiento horizontal en tablas.

### `js/main.js`
Se ejecuta al evento `DOMContentLoaded` y añade comportamiento progresivo sin llamadas `fetch` al backend:
- **Fondo animado**: Inserta `.liquid-canvas` con tres `.liquid-orb` al inicio de `document.body`.
- **Brillo interactivo en tarjetas**: Escucha `mousemove` sobre `.card` y `.glass-feature-card` para actualizar las variables CSS `--mouse-x` y `--mouse-y`.
- **Gestor de notificaciones (`showDynamicIsland` / `hideDynamicIsland`)**:
  - Intercepta cualquier `main .alert` renderizada por el servidor, la remueve del flujo normal y la muestra como notificación flotante autocerrable (3.8 segundos o al hacer clic).
  - Lee el parámetro `?msg=` de la URL (por ejemplo, al cerrar sesión desde `authController.logout`), despliega el aviso y limpia la barra de direcciones con `window.history.replaceState`.
- **Formulario de registro dinámico (`window.cambiarRolRegistro(rol)`)**: Alterna la visibilidad entre `#campos-medico` y `#campos-paciente` según el rol seleccionado.

---

## Comunicación con otras carpetas

```text
server.js (express.static) ──► public/ ◄── views/partials/ & views/*.ejs
                                  ▲
                                  └── Parámetros ?msg= y alertas generadas por controllers/
```

- **`server.js`**: Expone `public/` como directorio de archivos estáticos para que el navegador descargue `/css/style.css`, `/js/main.js` y `/assets/*`.
- **`views/`**: Las plantillas EJS (en especial `partials/header.ejs`, `partials/footer.ejs`, `partials/alert.ejs`, `registro.ejs` y `ver-expediente.ejs`) cargan estos recursos y proveen las clases e IDs (`main .alert`, `#campos-medico`, `#campos-paciente`, `.receta-box`) que `style.css` y `main.js` manipulan.
- **`controllers/`**: Relación indirecta; los controladores envían mensajes por redirección (`?msg=`, `?success=`, `?error=`) que las vistas plasman en HTML y `main.js` convierte en notificaciones flotantes.
- **`routes/`, `middleware/` y `database/`**: Sin acoplamiento directo.