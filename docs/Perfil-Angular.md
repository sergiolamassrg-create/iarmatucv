# Integración del perfil profesional en Angular

## Estado y recorrido

El usuario confirmó que las seis verificaciones de `Back End/scripts/verificar-perfil-real.ps1` devolvieron `true`: login real de Cognito, cookie JWT, sesión, lectura real del perfil y coincidencia con el sub. Esa confirmación permitió continuar con Angular. No se efectuaron escrituras de prueba contra DynamoDB.

Se conservaron Angular 22, la autenticación, el dashboard y su diseño. Se revisaron los prototipos de `Arquitectura AWS/02-iarmatucv-boceto/iarmatucv-dashboard` y `iarmatucv-perfil`, sin modificar sus originales ni ejecutar scripts de reemplazo. Del prototipo de perfil se adaptaron los seis pasos, las tarjetas y la columna lateral de resumen. Se usa el contrato real en español en lugar del modelo ilustrativo del prototipo. La pantalla final de [vista previa y PDF](Perfil-PDF.md) compone el CV desde el borrador. Se agregó Bootstrap mediante npm, usando únicamente su grilla CSS encapsulada en los campos del editor. No se importan su JavaScript, sus estilos globales ni bibliotecas de formularios adicionales.

Al iniciar sesión se abre `/panel`. Su servicio de perfil consulta automáticamente `GET /api/v1/perfil` con `withCredentials: true`. La portada del panel muestra carga, perfil existente, ausencia, error con reintento o sesión vencida. «Mi perfil» abre `/panel/perfil`, una ruta hija protegida que reutiliza el menú, tema y cierre de sesión del dashboard. La navegación entre panel y editor reutiliza la consulta; al recargar se vuelve a solicitar el documento al backend.

## Edición y conservación de datos

El formulario permite editar datos personales, resumen profesional, experiencia, educación, habilidades, idiomas, certificaciones, proyectos, licencias, voluntariados, reconocimientos, privacidad y datos pendientes de validación. Se organiza en seis pasos; «Idiomas y más» agrupa las secciones adicionales. Cambiar de paso no descarta información. La validación al guardar lleva al paso del primer campo inválido. Las listas permiten agregar y quitar elementos; quitar solo cambia el borrador hasta guardar. Los campos de lista de textos usan un elemento por línea. Se admite completar el perfil de a poco, sin datos profesionales inventados.

El borrador clona profundamente las trece secciones aceptadas por el PUT. Conserva sus campos internos sin controles visibles, identificadores, listas y valores null. No envía `userId`, fechas ni versión del servidor. Editar el correo de contacto no modifica el usuario de Cognito. Las preferencias de privacidad se guardan para el futuro uso en CV; el perfil no se publica.

Guardar envía `PUT /api/v1/perfil` con cookies y sustituye el borrador por el documento confirmado por el servidor. Los errores de guardado conservan los cambios para reintentar. Descartar restaura la última versión cargada o guardada. Se advierte antes de abandonar un borrador modificado, cerrar sesión o recargar la pestaña; durante el guardado se bloquean los controles y la navegación interna. No se agregó un botón para eliminar el perfil completo.

La API sigue siendo responsable de validar la información y seleccionar la clave a partir del JWT. Angular nunca selecciona un userId ni recibe credenciales AWS. Si recibe un 401, invalida la identidad local y ofrece volver a ingresar. No hay almacenamiento del perfil, contraseñas o tokens en localStorage ni sessionStorage. El servicio vive dentro del dashboard y se destruye al salir, para no conservar el perfil de una cuenta al cambiar de usuario.

## Archivos de esta integración

- `Front End/src/app/core/models/professional-profile.ts`: contrato, borrador y exclusión de metadatos.
- `Front End/src/app/core/services/profile.service.ts`: GET/PUT, estados, cookies y ciclo de vida del panel.
- `Front End/src/app/core/services/auth.service.ts`: invalidación de identidad local ante un 401.
- `Front End/src/app/features/profile/profile.component.ts`, `.html`, `.css`: editor y protección de cambios sin guardar.
- `Front End/src/app/features/profile/profile-fields.component.ts`, `.css`: campos reutilizables, ngModel y grilla Bootstrap.
- `Front End/src/app/features/profile/profile-form.config.ts`: campos y secciones del formulario.
- `Front End/src/app/features/dashboard/dashboard.component.ts`, `.html`, `.css`: servicio compartido, navegación y resumen de perfil.
- `Front End/src/app/app.routes.ts`, `app.component.ts`: ruta hija, guarda de salida y layout del panel.
- `Front End/package.json`, `package-lock.json`: Bootstrap instalado con npm.
- `Front End/tests/professional-profile.test.mjs`: conservación del documento y contrato de escritura.
- README de frontend y backend, `Back End/Perfil.md`, `docs/Dashboard.md` y `docs/Preparacion-AWS.md`: alcance y ejecución vigentes.

## Ejecución local

Desde `Back End`, con los valores privados de Cognito ya configurados en `.env`:

```powershell
$env:AUTH_MODE = 'jwt'
$env:AWS_PROFILE = 'iarmatucv-lab'
$env:AWS_REGION = 'us-east-1'
$env:DYNAMODB_PERFILES_TABLE = 'iarmatucv-perfiles'
$env:AUTH_COOKIE_SAME_SITE = 'lax'
$env:AUTH_COOKIE_PATH = '/api/v1'
npm.cmd run build
npm.cmd start
```

En otra terminal, desde `Front End`:

```powershell
npm.cmd start
```

Abrir `http://127.0.0.1:4200/acceso`, ingresar y elegir «Mi perfil». Usar el mismo host (127.0.0.1) para ambas aplicaciones y mantener ese origen permitido en `FRONTEND_ORIGINS`. Un 404 `PERFIL_NO_ENCONTRADO` ofrece crear el perfil; otros errores no se tratan como un perfil vacío. El modo local `session` conserva su login anterior, pero este CRUD requiere el modo JWT.

## Verificaciones y límites

```powershell
# Desde Front End
node --test tests/*.test.mjs
npm.cmd run typecheck
npm.cmd run build

# Desde Back End
npm.cmd test
npm.cmd run typecheck
```

Las pruebas unitarias verifican el borrador, independencia del documento original, conservación de campos y exclusión de identidad/metadatos. Las pruebas del navegador usan respuestas controladas, distintas de la lectura real confirmada por el usuario: login y guarda, carga automática, edición, listas repetibles, error/reintento de GET y PUT, recuperación después de recargar, validación nativa, confirmación de salida, ausencia de perfil, sesión vencida y continuidad del menú/tema. Se revisaron anchos de 320, 390, 768, 1024 y 1440 píxeles, en claro y oscuro, sin desbordamiento horizontal ni excepciones del navegador.

No se probó el PUT contra el registro real para no sobrescribir información. Una prueba manual autorizada puede editar un dato, guardar y recargar, verificando el valor y el resto del documento. No usar el registro demo ni otros usuarios. Los cambios concurrentes mantienen la limitación del backend: gana la última escritura.

No se desplegó ni se modificaron Cognito, DynamoDB, API Gateway o permisos. Para publicar faltan configurar la URL de API de producción (esta copia aún la tiene vacía), comprobar CORS/cookies en el dominio final y resolver `/panel/perfil` con el index.html de la SPA. La producción actual sin API configurada continúa bloqueando las solicitudes de forma controlada. La ampliación de [vista previa y PDF](Perfil-PDF.md) ya permite componer e imprimir un CV local desde el perfil; la biblioteca de CV guardados, las fotos e IA siguen pendientes.
