# iArmatuCV · Botonera v3

## Abrir
- `botonera.html`: laboratorio de ocho efectos interactivos.
- `index.html`: landing v2 con ajustes de hover en los CTA y enlace a la botonera.
- No requiere instalación, servidor ni Bootstrap.

## Referencias
Inspirado en https://prismic.io/blog/css-button-animations : #15 brillo, #22 deslizamiento, #24 borde, #28 envío, #31 reproducción SVG, #32 redes, #33 enlaces de cuadrícula, #40 burbujas. Son reinterpretaciones originales, no reproducciones del código de terceros.

## Archivos
- `animations.css`: clases independientes para reutilizar.
- `botonera.js`: feedback, envío simulado, partículas y controles.
- `botonera.html`: catálogo visual y pruebas.
- `styles.css`, `improvements.css`, `interactions.js`: landing previa.

## Uso en Angular
Copiar clases de `animations.css` al CSS del componente o estilos globales. Mover la lógica de `botonera.js` a handlers TypeScript de Angular; no manipular DOM directamente en producción.

## Reglas
- Hover no debe ser la única indicación de interacción; usar `:focus-visible`.
- Respeta `prefers-reduced-motion`.
- Usar animaciones intensas solo en CTA importantes, no en todos los botones.
- El envío es una simulación, no envía datos reales.
- Los íconos sociales son demostrativos y sus enlaces apuntan a las plataformas, no a perfiles oficiales.
