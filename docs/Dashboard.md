# Panel personal

El ingreso correcto desde `/acceso` navega a `/panel`. Se adaptó el boceto de `Arquitectura AWS/02-iarmatucv-boceto/iarmatucv-dashboard/` a componentes Angular y a los colores, fuentes, ilustración y temas actuales, conservando los originales.

## Alcance

- Bienvenida, datos de la cuenta y estado real de verificación del correo obtenido de la API.
- Enlaces al catálogo de plantillas, consejos, cuenta y sitio público.
- Menú lateral en escritorio y diálogo nativo en celular, con cierre mediante Escape, fondo o botón. Al cerrar vuelve el foco al botón de apertura.
- Tema compartido entre portada, acceso y panel.
- Cierre de sesión con estado de espera y mensaje de error que permite reintentar.

El perfil profesional se consulta y edita desde `/panel/perfil`, reutilizando el CRUD de DynamoDB y la autenticación JWT; ver [integración del perfil](Perfil-Angular.md). Desde el panel se puede preparar un CV y abrir su [vista previa / impresión PDF](Perfil-PDF.md). La biblioteca de CV guardados e IA siguen pendientes. No se muestran métricas ficticias.

El contrato actual de usuario contiene `id`, `username`, `nickname`, `email` y `emailVerified`. El backend obtiene `nickname` de los atributos de Cognito. La bienvenida y la etiqueta de la cuenta usan ese apodo completo, sin recortarlo ni deducirlo del correo. Si está ausente o vacío, se muestra un saludo general y «Mi cuenta». Después de actualizar el backend, volver a iniciar sesión para renovar los datos de una sesión local existente.

## Sesión y rutas

La guarda de `/panel` espera la consulta inicial a `/auth/sesion`. Una sesión válida permite abrir y recargar el panel; sin sesión o si la consulta falla, navega a `/acceso`. El control del frontend organiza la navegación; el backend sigue siendo responsable de autenticar y autorizar las operaciones.

Se mantiene el contrato existente con cookies HttpOnly tanto para las sesiones locales como para el modo JWT de Lambda. No se guardan credenciales ni tokens en localStorage o sessionStorage. La única preferencia persistida por Angular es el tema.

La URL de API de producción sigue pendiente. No se habilitó un acceso ficticio al panel: sin API configurada, la guarda dirige a `/acceso`. El alojamiento estático deberá resolver `/panel`, `/acceso` y `/estado` con el `index.html` raíz, sin reescribir las solicitudes de la API ni los archivos estáticos. No se modificó ningún recurso AWS.

## Verificación local

Desde `Front End`:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

Se verificaron en navegador ingreso correcto e incorrecto, recarga con respuesta de sesión demorada, acceso anónimo, fallo de sesión, cierre de sesión fallido y reintento, navegación al sitio público y continuidad del tema. Las respuestas de autenticación se simularon en el navegador, sin operar sobre Cognito ni crear usuarios.

Se revisaron los temas claro y oscuro en anchos de 320, 360, 390, 540, 760, 768, 1024, 1280, 1440 y 1920 píxeles, sin desbordamiento horizontal; también menú con teclado, Escape y cambio de tamaño, y datos de usuario largos. Esto no sustituye una prueba con una cuenta real y la API desplegada.

El build de producción también se abrió mediante un servidor estático local: `/panel` dirigió a `/acceso` sin API configurada y el intento de ingreso mostró un error controlado, sin solicitudes XHR/Fetch. Se comprobó que el resultado no contiene las URLs locales de API, mapas de fuentes ni los valores privados de sesión y Client Secret presentes en el `.env` del servidor.
