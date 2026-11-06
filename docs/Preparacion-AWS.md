# Preparación de Angular para AWS — primera intervención

Fecha: 2026-11-04. Alcance: auditoría local y preparación del frontend. No se migró Express, no se ejecutaron operaciones contra AWS y no se hicieron commits ni push. Se conservaron los cambios que ya estaban en el directorio de trabajo.

Evolución posterior: la etapa 2 conserva Express y adapta su ejecución a Lambda Node.js; ver [implementación vigente](Lambda-Node.md). Las propuestas Python/PKCE de este informe inicial no se implementaron y quedan sustituidas por esa decisión. La preparación y configuración Angular de esta etapa se mantienen.

## Auditoría

La copia local está en `main`, con origen `https://github.com/sergiolamassrg-create/iarmatucv.git`. No se descargaron ni publicaron cambios de GitHub durante esta intervención.

| Área | Estado observado |
|---|---|
| Portada, rutas y diseño | Implementados en Angular; estilos nativos, fuentes e ilustración locales. Se conservan. |
| Catálogo | Angular consulta Express; seis plantillas en un array del repositorio. No hay persistencia. |
| Autenticación | Formularios conectados a Express y SDK de Cognito. Registro en dos pasos con nombre, apellido, nombre para mostrar, correo y contraseña. |
| Sesiones | Cookie HttpOnly y express-session con MemoryStore. Dependen de una instancia Express; no son una solución para Lambda. |
| Verificación de Cognito | No se confirmó un ciclo real completo de registro, correo, ingreso y salida. En esta intervención no se realizaron llamadas a AWS. |
| Persistencia y área privada | CRUD de CV, DynamoDB y autorización por propietario pendientes. La vista de cuenta no es un gestor de CV. |
| Backend AWS | API Gateway, Lambda Python y validación JWT pendientes de diseño aprobado e implementación. |
| Publicación | No verificada aquí. Bucket, permisos y disponibilidad de CloudFront/Cognito provienen de lo informado por el usuario. |

Dependencias HTTP actuales, todas bajo `/api/v1`:

- `GET /health`: `{data: {estado: 'ok', servicio: string}}`.
- `GET /plantillas`: `{data: [{slug, name, description, label}]}`.
- `GET /auth/sesion`: `{data: usuario | null}`; el usuario incluye `id`, `username`, `nickname`, `email`, `emailVerified`.
- `POST /auth/registro`: `name`, `familyName`, `nickname`, `email`, `password`; devuelve `{data: {confirmed: boolean}}`.
- `POST /auth/confirmacion`: `email`, `code`.
- `POST /auth/reenviar-codigo`: `email`.
- `POST /auth/ingreso`: `email`, `password`; devuelve el usuario y establece la cookie.
- `POST /auth/recuperacion`: `email`.
- `POST /auth/restablecer`: `email`, `code`, `password`.
- `POST /auth/salida`: cuerpo vacío.

Las operaciones auxiliares de autenticación devuelven `{data: {message: string}}`. Los errores usan `{error: {codigo, mensaje}}`. Las solicitudes de autenticación envían `withCredentials: true`; los POST requieren JSON y un origen permitido. Cambiar solamente la URL a API Gateway no reemplaza este contrato de sesión por JWT.

## Cambios de esta etapa

| Archivo | Cambio |
|---|---|
| `Front End/angular.json` | Reemplaza la configuración de entorno únicamente en producción. |
| `Front End/src/environments/environment.ts` | Desarrollo: `production: false`, API local existente. |
| `Front End/src/environments/environment.production.ts` | Producción: `production: true`, API pendiente con cadena vacía. |
| `Front End/src/app/core/config/api.config.ts` | Construye URLs; rechaza API pendiente y, en producción, URLs sin HTTPS, locales, con credenciales, query o fragmento. |
| `Front End/src/app/core/services/auth.service.ts` | Conserva sus métodos; omite la restauración si no hay API y bloquea las solicitudes con un mensaje controlado. |
| `Front End/src/app/core/services/health.service.ts` | Usa la URL del entorno y no consulta una API pendiente. |
| `Front End/src/app/core/services/templates.service.ts` | Mismo tratamiento para el catálogo. |
| `Front End/README.md`, `README.md`, este documento | Configuración, hallazgos y próximos pasos. |

No se modificaron componentes, estilos, rutas, imágenes, dependencias, lockfiles ni archivos del backend durante esta intervención.

## Configuración y ejecución

Desde `Front End`:

```powershell
npm.cmd start
```

Usa `development` y mantiene la API `http://127.0.0.1:3000/api/v1`.

```powershell
npm.cmd run build
```

Usa `production` y genera `dist/iarmatucv/browser/`. La URL de API en `environment.production.ts` queda deliberadamente vacía hasta disponer de una URL real y compatible. No se usa la URL del sitio como sustituto ni se envían solicitudes relativas por accidente. La portada y las rutas se pueden publicar como archivos estáticos, pero catálogo, consulta de estado y autenticación no estarán operativos sin API. El acceso muestra un aviso de servicio todavía no habilitado.

Cuando exista la API, completar `apiBaseUrl` con su URL HTTPS real, incluyendo la ruta base correspondiente al contrato `/api/v1`, y recompilar. No colocar Client Secret, Session Secret, claves IAM ni tokens en ninguno de los entornos: esos archivos se incorporan al JavaScript público. Angular no consume `Back End/.env`.

Las validaciones locales de esta etapa incluyen build de producción, verificación de tipos, revisión del bundle, comprobación de secretos sin imprimir sus valores, pruebas del sitio estático con API pendiente y comprobación del contrato local. Las pruebas con respuestas controladas no equivalen a verificar Cognito real ni un despliegue AWS.

Resultados: build y typecheck correctos; cero URLs de API locales en los archivos públicos generados; los dos valores privados presentes en el `.env` no aparecen en el build; cero mapas de fuentes; cero solicitudes XHR/Fetch de la versión de producción durante navegación, ingreso y registro con API pendiente. Se comprobaron apertura y recarga de `/acceso` y `/estado` en el servidor estático de prueba. Desarrollo mantuvo seis plantillas, health correcto y el contrato de autenticación probado con respuestas controladas. No se ejecutó `npm ci` local porque no cambiaron dependencias ni lockfile y la instalación existente compiló correctamente.

## Publicación estática y navegación

Según lo informado, el bucket es `iarmatucv-pp3-2026`, en `us-east-1`, con bloqueo público activado. Se mantiene esa restricción.

Si el laboratorio permite CloudFront y configurar su acceso al bucket, proponer origen S3 REST privado con OAC y HTTPS para visitantes. No usar el endpoint S3 Website como origen privado con OAC. Sin CloudFront u otra alternativa HTTPS privada autorizada, la publicación queda pendiente: no desactivar el bloqueo ni publicar un login por HTTP para resolverlo.

Angular necesita que el alojamiento entregue el `index.html` raíz al abrir o recargar `/acceso`, `/estado`, `/panel` y `/panel/perfil`. El router no configura S3 o CloudFront automáticamente. Proponer una reescritura de esas rutas al `index.html` raíz, asociada al comportamiento estático, conservando query strings y sin reescribir `/api/*` ni archivos de `assets/`. El objeto raíz predeterminado por sí solo no resuelve esas rutas. Evitar convertir indiscriminadamente errores de la API en HTML con estado 200.

Los ejemplos de CloudFront que agregan `/index.html` a cada ruta deben adaptarse a esta SPA: no hay un archivo `/acceso/index.html`, sino un único `/index.html`. La vista previa estática local de esta intervención simula esa reescritura; no configura CloudFront.

## Procedimiento propuesto para CloudShell

Estos comandos se preparan como guía. No se ejecutaron y los que acceden a AWS requieren autorización antes de usarse.

Para una copia nueva:

```bash
git clone --branch main https://github.com/sergiolamassrg-create/iarmatucv.git
cd iarmatucv
```

Para actualizar una copia existente, comprobar primero que no haya cambios locales; no usar reset ni descartar archivos:

```bash
git status --short
git pull --ff-only origin main
```

Con Node compatible con el requisito actual `>=24.22.1 <25`, y desde la raíz:

```bash
node --version
npm --version
npm --prefix "Front End" ci
npm --prefix "Front End" run build
test -f "Front End/dist/iarmatucv/browser/index.html"
```

Antes de subir, revisar que el build no incluya URLs de API locales, archivos `.env`, secretos o mapas de fuentes innecesarios. Si `apiBaseUrl` sigue vacío, esta entrega es solamente la base estática; no anunciarla como servicio con autenticación operativa.

Solo después de autorizar la publicación y confirmar destino y permisos, sincronizar el contenido de `browser/`, sin subir `src/`, `node_modules/`, `.env` ni la carpeta del backend:

```bash
aws s3 sync "Front End/dist/iarmatucv/browser/" "s3://iarmatucv-pp3-2026/" --region us-east-1 --exclude "index.html"
aws s3 cp "Front End/dist/iarmatucv/browser/index.html" "s3://iarmatucv-pp3-2026/index.html" --region us-east-1 --cache-control "no-cache" --content-type "text/html"
```

No se usa `--delete`, ACL pública ni claves permanentes. Publicar el índice al final y conservar los objetos anteriores evita eliminar los bundles que aún referencian páginas en caché. Confirmar después la política de caché y, si corresponde, una invalidación de la distribución real ya autorizada. La limpieza posterior de objetos antiguos requiere revisión independiente.

Comprobar por HTTPS: `/`, navegación y recarga de `/acceso` y `/estado`, imagen, fuentes, favicon, ausencia de contenido mixto y comportamiento explícito mientras la API esté pendiente. Una carga correcta desde CloudFront no prueba que el backend esté desplegado.

## Próximo paso: diseño mínimo a aprobar

Conservar Express local y aprobar primero el contrato de autenticación serverless. Proponer Cognito con flujo de código y PKCE para un cliente público sin secreto en Angular; confirmar antes que Academy permita ese app client y su configuración. Mantener tokens de acceso en memoria, no en localStorage. Definir explícitamente expiración, recarga y salida antes de implementar; no copiar MemoryStore a Lambda ni desarrollar contraseñas propias.

Para el MVP AWS, evaluar una Lambda Python con un handler para HTTP API payload v2, un módulo de operaciones y un repositorio DynamoDB. Mantener los contratos de health y catálogo. Separar rutas públicas y protegidas, usar un JWT authorizer con issuer y audience correctos y exigir access tokens mediante scopes o comprobaciones complementarias. Obtener `sub` de claims verificados y usarlo como propietario en todas las claves y operaciones de CV; nunca aceptar el propietario desde el cuerpo enviado por Angular.

Antes de código o recursos: aprobar campos del CV, rutas CRUD, estrategia JWT, lista exacta de orígenes CORS, manejo de errores, variables de entorno y política IAM. Verificar disponibilidad y alcance de LabRole; limitar Lambda a logs y operaciones necesarias sobre la tabla real de DynamoDB. No crear proveedores OIDC, roles arbitrarios, tablas, funciones o distribuciones desde esta intervención.

## Referencias oficiales

- [Entornos Angular](https://angular.dev/tools/cli/environments)
- [Publicación y rutas SPA](https://angular.dev/tools/cli/deployment)
- [S3 Website y HTTPS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html)
- [CloudFront con origen S3 privado](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Reescritura de URLs en CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html)
- [JWT authorizers en API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
