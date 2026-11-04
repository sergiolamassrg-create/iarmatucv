# iArmatuCV — Front End

Angular 22, TypeScript 6.0 y HTML/CSS nativo. Aplicación SPA sin Bootstrap, React ni herramientas de diseño adicionales.

## Comandos propios

Desde esta carpeta:

```powershell
npm.cmd install
npm.cmd start
npm.cmd run typecheck
npm.cmd run build
```

Abrir http://127.0.0.1:4200/. El build produce `dist/iarmatucv/browser/`; no abrir su `index.html` con `file://`. El despliegue está pendiente. `npm ci` reinstala las versiones del lockfile.

Se usa Node 24.22.1 y se declara Node >=24.22.1 y <25. Angular se migró de 20 a 21 y luego a 22 mediante `ng update`. TypeScript permanece en la rama 6.0 porque es la admitida por Angular 22. Referencia oficial de compatibilidad: https://angular.dev/reference/versions. El lockfile fija las versiones de las dependencias.

Se fija Vite 8.3.5 mediante `overrides` porque Angular Build 22.2.4 incluye una versión anterior afectada por vulnerabilidades corregidas en esa rama. Referencia: https://github.com/advisories/GHSA-587h-7wmj-h5pm.

## Rutas

| Ruta | Función |
|---|---|
| `/` | Portada animada, seis diseños seleccionables, vista previa y preguntas |
| `/acceso` | Informa que registro/login aún no están disponibles; no pide contraseñas |
| `/estado` | Consume el healthcheck del backend mediante HttpClient |
| Otra | Página de recurso no encontrado |

## Estructura y contenidos de la cursada

```text
src/app/
  app.config.ts       Router, HttpClient y configuración Angular
  app.routes.ts       Navegación SPA
  app.component.ts    Layout compartido
  core/models/        Interfaces TypeScript del contrato HTTP
  core/services/      Servicio de comunicación con la API
  shared/             Header, footer, iconos SVG y vista de CV reutilizable
  features/           Inicio, acceso, estado y página no encontrada
src/styles.css        Tokens y estilos responsive
src/environments/     URL pública de API
```

Se aplican HTML semántico, CSS, Grid/Flexbox, componentes, templates, binding, eventos, servicios, inyección de dependencias, routing, `@if`/`@for` y HttpClient. Son contenidos del programa de Front End. Formularios reactivos se incorporarán al implementar el editor, no hay formularios ficticios en esta fase.

## Comunicación

La URL pública vive en `src/environments/environment.ts`. No colocar credenciales ni claves AWS. Si cambia el puerto de Express, actualizar la URL; si cambia el origen de Angular, actualizar `FRONTEND_ORIGINS` del backend. El frontend no se conecta a PostgreSQL.

Los servicios usan Observable de HttpClient con un límite de espera de cinco segundos. `/estado` consulta `/api/v1/health` y la galería de inicio obtiene sus diseños desde `/api/v1/plantillas`. El catálogo se mantiene en el backend; no se duplica en Angular. La galería muestra carga, error con reintento y catálogo vacío si corresponde.

## Diseño

Se consultaron los bocetos y la botonera v3 dentro de `../Arquitectura AWS/02-iarmatucv-boceto/`. Se conservan paleta, gradiente, marca, tarjetas, ejemplos de CV y temas, implementados como componentes y CSS legible. Los originales no fueron editados.

La portada recupera la ilustración del boceto original, copiada a `public/assets/hero-reference.png`. DM Sans y Outfit se sirven como fuentes variables locales desde `public/assets/fonts/`, con sus licencias SIL OFL incluidas. Se obtuvieron del repositorio oficial Google Fonts; durante la navegación no se necesitan conexiones a Google para cargarlas.

La galería usa un componente Angular reutilizable con seis variantes visuales. La selección actual se mantiene en memoria y actualiza el nombre y la descripción mediante binding. Un dialog HTML nativo permite ampliar la referencia y comparar con botones o flechas de teclado; Escape cierra la vista. La selección no se aplica a un CV ni se persiste. El diálogo contiene el foco y el cierre devuelve al control que lo abrió.

El movimiento usa CSS nativo: entrada de portada, flotación suave de la ilustración, destellos, brillo de botones, efectos de hover/foco y transiciones del tema. `prefers-reduced-motion` desactiva estas animaciones. No se agregaron librerías visuales ni dependencias de animación.

Los diseños usan datos ficticios y la ilustración representa la visión del producto. IA, PDF, edición, guardado y autenticación siguen pendientes; no se presentan cifras ficticias como métricas reales.

La preferencia de tema es el único dato guardado en localStorage. No se guardan CV, sesiones ni datos personales. El almacenamiento bloqueado no debe impedir navegar. Se incluyen foco visible, enlace para saltar al contenido y movimiento reducido; esto no equivale a certificación de accesibilidad.
