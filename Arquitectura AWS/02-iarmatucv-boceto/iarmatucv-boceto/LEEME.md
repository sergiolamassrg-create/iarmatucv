# iArmatuCV — Boceto v2

Prototipo estático con HTML, CSS y JavaScript nativos, **sin Bootstrap**.

## Cómo abrirlo

Abrí `index.html` en Chrome o Edge. No requiere servidor ni instalación.

## Mejoras respecto a v1

- Contraste y colores del modo oscuro revisados.
- Íconos consistentes en SVG (sprite local, sin dependencias externas).
- Hover y estados de foco en navegación, botones, tarjetas y plantillas.
- Selección real de plantillas con mouse o teclado.
- Modales de demostración para iniciar sesión y crear CV, sin fingir que existe backend.
- Preferencia de tema persistente en localStorage cuando está disponible.
- Tipografía y espaciados refinados.
- Respetar preferencia de movimiento reducido.

## Archivos

- `index.html`: estructura y componentes.
- `styles.css`: CSS original v1.
- `improvements.css`: mejoras y sobrescrituras v2.
- `interactions.js`: interacción de demostración.
- `assets/hero-reference.png`: recorte de la imagen de referencia.

## Pendiente

La imagen principal original tiene fondo blanco opaco; en modo oscuro se integra como una tarjeta clara con bordes suavizados. Para que realmente se fusione con el fondo oscuro se necesita un recorte transparente de la ilustración original. Las cifras de portada son ficticias y están etiquetadas como tales. Los botones de creación e inicio de sesión abren un modal informativo; no hay autenticación ni IA todavía.
