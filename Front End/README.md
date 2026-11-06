# iArmatuCV — Front End

Angular 22, TypeScript 6.0 y HTML/CSS. Aplicación SPA con estilos propios; el editor de perfil utiliza la grilla CSS de Bootstrap encapsulada, sin su JavaScript ni estilos globales.

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

## Desarrollo y producción

`npm start` conserva la API local de `src/environments/environment.ts`. `npm run build` usa `environment.production.ts` mediante fileReplacements de Angular. La URL de producción queda vacía hasta disponer de una API HTTPS real: las solicitudes se bloquean de forma controlada y el acceso informa que el servicio todavía no está habilitado. Esto permite preparar la publicación estática sin enviar credenciales a localhost ni a una API ficticia. No agregar secretos en estos archivos públicos.

Ver [auditoría, preparación AWS y procedimiento propuesto](../docs/Preparacion-AWS.md). La carpeta a publicar es solamente `dist/iarmatucv/browser/`. El alojamiento debe resolver la recarga de las rutas SPA con el `index.html` raíz. Cambiar la URL no migra las sesiones Express a JWT ni implementa Lambda.

## Rutas

| Ruta | Función |
|---|---|
| `/` | Portada animada, seis diseños seleccionables, vista previa y preguntas |
| `/acceso` | Ingreso, registro, confirmación, recuperación y sesión con Cognito a través de la API |
| `/panel` | Espacio personal protegido: bienvenida, cuenta, plantillas y funciones futuras |
| `/panel/perfil` | Consulta y edición del perfil profesional propio con cookies JWT |
| `/estado` | Consume el healthcheck del backend mediante HttpClient |
| Otra | Página de recurso no encontrado |

## Estructura y contenidos de la cursada

```text
src/app/
  app.config.ts       Router, HttpClient y configuración Angular
  app.routes.ts       Navegación SPA
  app.component.ts    Layout compartido
  core/guards/        Guarda de sesi?n para el panel
  core/models/        Interfaces TypeScript del contrato HTTP
  core/services/      Servicio de comunicación con la API
  shared/             Header, footer, iconos SVG y vista de CV reutilizable
  features/           Inicio, acceso, estado y página no encontrada
src/styles.css        Tokens y estilos responsive
src/environments/     URL pública de API
```

Se aplican HTML semántico, CSS, Grid/Flexbox, componentes, templates, binding, eventos, servicios, inyección de dependencias, routing, `@if`/`@for` y HttpClient. La vista previa de acceso usa FormsModule, ngModel y NgForm para validar campos requeridos, formato de correo y coincidencia de contraseñas. Los formularios reactivos del editor siguen pendientes.

## Acceso con Cognito

Se incorporó el boceto de `../Arquitectura AWS/02-iarmatucv-boceto/iarmatucv-login/` como template y CSS del componente de acceso. Se reutilizan las fuentes, variables de color, gradientes, botones e ilustración actuales; los originales se conservan. La interfaz se adapta a celular y a los temas claro y oscuro.

Los formularios consumen `/api/v1/auth`: registro, confirmación y reenvío de códigos, ingreso, recuperación y nueva contraseña. Al ingresar se muestra la cuenta y se habilita el cierre de sesión. La cookie HttpOnly mantiene la sesión al recargar; los tokens y el Client Secret permanecen en el servidor. Las contraseñas y códigos se limpian después de cada solicitud y al cambiar de vista. Cognito aplica la política real de contraseñas. La gestión de CV sigue pendiente.

En celular se priorizan el formulario y los botones de ingreso/registro: se oculta la presentación y el encabezado de acceso muestra solo la marca y el cambio de tema. En tablet el formulario aparece antes de la presentación. Se mantiene el desplazamiento natural para pantallas bajas, teclado en pantalla y mensajes de validación.

Completar la configuración privada en `../Back End/.env` y revisar los pasos de [Cognito](../docs/Cognito.md). Angular no lee ese archivo ni contiene secretos. La configuración del app client debe admitir `ALLOW_USER_PASSWORD_AUTH`; un cliente configurado solamente para el ejemplo OAuth/EJS no habilita este flujo automáticamente. No se configuraron recursos AWS desde el código.

## Comunicación

La URL pública vive en `src/environments/environment.ts`. No colocar credenciales ni claves AWS. Si cambia el puerto de Express, actualizar la URL; si cambia el origen de Angular, actualizar `FRONTEND_ORIGINS` del backend. El frontend no se conecta a PostgreSQL.

Los servicios usan Observable de HttpClient: catálogo y estado tienen un límite de espera de cinco segundos, acceso de 25 y perfil de 30. `/estado` consulta `/api/v1/health` y la galería de inicio obtiene sus diseños desde `/api/v1/plantillas`. El catálogo se mantiene en el backend; no se duplica en Angular. La galería muestra carga, error con reintento y catálogo vacío si corresponde.

## Diseño

El perfil profesional se integra con GET/PUT del backend desde el dashboard. Ver [flujo, archivos, ejecución local y verificaciones](../docs/Perfil-Angular.md). Requiere `AUTH_MODE=jwt` en el backend; el formulario conserva campos internos que todavía no tienen controles visibles. La pantalla final permite [componer e imprimir un CV A4 como PDF](../docs/Perfil-PDF.md), sin agregar persistencia de CV ni eliminación del perfil completo.

Se consultaron los bocetos y la botonera v3 dentro de `../Arquitectura AWS/02-iarmatucv-boceto/`. Se conservan paleta, gradiente, marca, tarjetas, ejemplos de CV y temas, implementados como componentes y CSS legible. Los originales no fueron editados.

La portada recupera la ilustración del boceto original, copiada a `public/assets/hero-reference.png`. DM Sans y Outfit se sirven como fuentes variables locales desde `public/assets/fonts/`, con sus licencias SIL OFL incluidas. Se obtuvieron del repositorio oficial Google Fonts; durante la navegación no se necesitan conexiones a Google para cargarlas.

La galería usa un componente Angular reutilizable con seis variantes visuales. La selección actual se mantiene en memoria y actualiza el nombre y la descripción mediante binding. Un dialog HTML nativo permite ampliar la referencia y comparar con botones o flechas de teclado; Escape cierra la vista. La selección no se aplica a un CV ni se persiste. El diálogo contiene el foco y el cierre devuelve al control que lo abrió.

El movimiento usa CSS nativo: entrada de portada, flotación suave de la ilustración, destellos, brillo de botones, efectos de hover/foco y transiciones del tema. `prefers-reduced-motion` desactiva estas animaciones. No se agregaron dependencias de animación.

La galería de diseños usa datos ficticios; su selección todavía no se aplica al CV real. El editor guarda el perfil y la pantalla final permite elegir [ATS Clásica o Profesional Moderna](../docs/Plantillas-CV.md), ordenar secciones e imprimir A4 con los datos elegidos y enlaces clicables. IA, fotos y múltiples CV guardados siguen pendientes. No se presentan cifras ficticias como métricas reales. El acceso requiere la configuración de Cognito indicada arriba.

La preferencia de tema es el único dato guardado en localStorage. La sesión usa una cookie HttpOnly y datos del lado servidor; el frontend no persiste credenciales, tokens ni CV. El almacenamiento bloqueado no debe impedir navegar por las páginas públicas. Se incluyen foco visible, enlace para saltar al contenido y movimiento reducido; esto no equivale a certificación de accesibilidad.
