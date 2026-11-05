# Etapa 2 — Express y Node.js en Lambda

Fecha: 2026-11-04. La decisión vigente es conservar Node.js, Express y TypeScript también en AWS. Sustituye la propuesta anterior de migración a Python. Implementación y verificaciones locales; no se crearon recursos, no se desplegó, no se modificó Cognito y no se hizo commit ni push.

## Auditoría y alcance

El backend ya separaba rutas, controladores, servicios y repositorio. Health y catálogo no usan persistencia; el catálogo mantiene seis plantillas en memoria. Cognito implementa registro, confirmación, reenvío, ingreso, recuperación y nueva contraseña mediante el SDK oficial. Las respuestas JSON nunca incluyen los tokens.

El bloqueo para Lambda era express-session/MemoryStore: la identidad dependía de la memoria de una instancia. Se conserva ese modo exclusivamente para desarrollo local y se agrega un transporte JWT sin almacenamiento de sesiones. Las validaciones de datos y operaciones Cognito se reutilizan. No se agregó DynamoDB ni CRUD de CV, y no se modificó Angular.

## Entradas y archivos

| Archivo | Responsabilidad |
|---|---|
| `Back End/src/app.ts` | Fábrica `createApp`, compartida por servidor y Lambda. |
| `Back End/src/server.ts` | Servidor HTTP local; único punto que abre un puerto. |
| `Back End/src/lambda.ts` | Handler `dist/lambda.handler`, adaptador serverless-http, HTTP API payload v2. Fuerza JWT y cookies Secure. |
| `Back End/src/config/environment.ts` | Modo, orígenes exactos, configuración Cognito y cookies. Producción/Lambda rechazan MemoryStore. |
| `Back End/src/models/auth-context.ts` | Tipos del transporte, identidad verificada y tokens internos. |
| `Back End/src/services/jwt.service.ts` | Verificador Cognito y caché de claves públicas JWKS. |
| `Back End/src/services/auth-transport.service.ts` | Lectura, validación, apertura y cierre de sesión/cookies según modo. |
| `Back End/src/middlewares/require-auth.middleware.ts` | Exige identidad verificada para la ruta de perfil. |
| `Back End/src/middlewares/auth-session.middleware.ts` | MemoryStore se instancia solo si se selecciona el modo local. |
| `Back End/src/controllers/auth.controller.ts` | Conserva operaciones y respuestas; delega el transporte. |
| `Back End/src/services/auth.service.ts` | Reutiliza Cognito; ya no exige Session Secret para operaciones JWT. |
| `Back End/src/routes/api.routes.ts`, `auth.routes.ts` | Fábricas y ruta protegida de perfil. |
| `Back End/tests/helpers.mjs` | Claves RSA de prueba generadas en memoria, SDK simulado y eventos HTTP v2. |
| `Back End/tests/auth.test.mjs`, `lambda.test.mjs` | Regresión local, JWT y adapter HTTP API. |
| `Back End/package.json`, `package-lock.json`, `.env.example` | Dependencias, comando test y configuración de ejemplo. |
| `.gitignore` | Ignora carpetas temporales de empaquetado y ZIP de Lambda. |
| `README.md`, `Back End/README.md`, `docs/Cognito.md`, `docs/Preparacion-AWS.md`, `docs/IACV-ADR-001_Cimientos_y_decisiones.md` | Documentación actualizada a la decisión Node.js/JWT y límites verificados. |

Las dependencias nuevas se instalaron mediante npm: serverless-http 4, aws-jwt-verify 5 y cookie 2; `@types/aws-lambda` es solo de desarrollo. Se mantienen express-session y sus tipos para el modo local. Las pruebas usan Node Test Runner, sin plataforma adicional.

## Cómo funciona la autenticación

**Local, `AUTH_MODE=session`:** se conserva el contrato anterior: Cognito autentica, el servidor regenera una sesión y entrega `iarmatucv.sid`, HttpOnly. Tokens y refresh token permanecen en MemoryStore. Reiniciar el servidor elimina esas sesiones. `SESSION_SECRET` debe tener al menos 32 caracteres. Este modo está prohibido cuando `NODE_ENV=production` o existe `AWS_LAMBDA_FUNCTION_NAME`.

**Lambda, modo JWT:** el handler fuerza JWT aunque se lo invoque en una prueba local. El ingreso conserva `{data: usuario}` y entrega el access token en `iarmatucv.access` y el refresh token en `iarmatucv.refresh`, ambos HttpOnly y Secure en Lambda. No hay identificador de sesión, mapa de usuarios ni MemoryStore. El refresh token se usa únicamente para solicitar su revocación al salir; todavía no se renueva automáticamente el access token. El refresh token se guarda como cookie de sesión del navegador, sin una duración inventada que sustituya la política de Cognito.

En cada solicitud autenticada se comprueba el access token mediante aws-jwt-verify: clave pública del User Pool configurado, firma, algoritmo, issuer, expiración, `nbf` si existe, `token_use=access` y `client_id` correspondiente. También se exige `sub` no vacío y `exp` numérico vigente. No se aceptan ID tokens, JWT solo decodificados ni un identificador de usuario enviado por el cliente. Se cachean claves públicas, no identidades. Una nueva instancia puede atender la misma cookie sin recuperar memoria de otra.

También se admite `Authorization: Bearer <access-token>` en modo JWT. Un encabezado presente pero inválido no se reemplaza silenciosamente por una cookie. El frontend actual continúa usando cookies y `withCredentials`; no necesita recibir ni guardar JWT en JavaScript o localStorage.

`GET /api/v1/auth/sesion` conserva `{data: null}` si no hay credenciales. Credenciales JWT inválidas producen 401. `GET /api/v1/auth/perfil` es una ruta protegida explícita: sin identidad válida responde 401. Ambas consultas obtienen los atributos actuales mediante `GetUser` de Cognito; se verifica que su identificador coincida con el `sub` firmado. Esto también permite detectar revocación en esas consultas. El resto de las operaciones públicas de registro y recuperación mantienen sus rutas y formatos; ver [Cognito](Cognito.md).

Los errores JWT no devuelven el token ni detalles criptográficos al cliente. Si falla la descarga de claves, se rechaza el acceso con 503 y no se borra una cookie que podría seguir siendo válida. La salida borra las cookies o la sesión local y solicita `RevokeToken` si se dispone del refresh token. Si Cognito no responde, se informa que el cierre remoto no pudo completarse.

## Variables del servidor

| Variable | Local | Lambda |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `AUTH_MODE` | `session` por defecto; `jwt` para probar la variante | `jwt`, o ausente para selección automática; `session` se rechaza |
| `COGNITO_REGION` | Región existente | `us-east-1`, si es la región del pool |
| `COGNITO_USER_POOL_ID` | Necesario al probar JWT | ID real del User Pool; necesario para verificar issuer y firma |
| `COGNITO_CLIENT_ID` | Cliente existente | Mismo app client que emite los access tokens |
| `COGNITO_CLIENT_SECRET` | Si ese app client tiene secreto | Valor privado del mismo cliente, si tiene secreto |
| `SESSION_SECRET` | Obligatorio para abrir una sesión local | No se usa ni se requiere en JWT |
| `FRONTEND_ORIGINS` | Orígenes locales actuales | Lista obligatoria de orígenes HTTPS exactos, sin `/` final ni `*` |
| `AUTH_COOKIE_SAME_SITE` | `lax` por defecto | `none` por defecto para frontend/API en sitios distintos; `lax` si se sirven bajo el mismo sitio |
| `AUTH_COOKIE_PATH` | `/api/v1` | `/api/v1` con etapa `$default`; incluir cualquier prefijo visible adicional del dominio/etapa |
| `HOST`, `PORT` | Servidor local | No se usan para abrir un servidor en Lambda |

No copiar `.env` al ZIP. Configurar los valores privados en variables de la función por un mecanismo autorizado y no incluirlos en comandos, logs, GitHub ni Angular. Las operaciones de usuarios implementadas no usan llamadas Cognito Admin ni requieren claves IAM permanentes: usan Client ID, Client Secret si corresponde y los tokens del usuario.

El pool y app client existentes deben seguir permitiendo `ALLOW_USER_PASSWORD_AUTH`, registro y los atributos `email`, `name`, `family_name`, `nickname`. No se modificaron esos ajustes. La autorización de JWT se aplica en Lambda; no es necesario crear un nuevo app client para esta estrategia.

## Compilación y pruebas locales

Desde `Back End`, con Node `>=24.22.1 <25`:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run dev
```

`npm test` compila y ejecuta pruebas persistentes de regresión. Generan claves y JWT sintéticos en memoria y sustituyen Cognito; la descarga JWKS se bloquea en las pruebas. No crean usuarios ni llaman a AWS. Se comprueban rutas, cookies, CORS, datos requeridos, sesiones locales, errores, payload base64, respuestas multicookie, invocaciones calientes y arranque de producción.

También se rechazan firma alterada, issuer/cliente equivocados, ID token, algoritmo incorrecto, clave desconocida, vencimiento, ausencia de `sub`/`exp` y `nbf` futuro. Las pruebas no sustituyen una prueba posterior en AWS con HTTPS y una cuenta propia.

Resultado de esta intervención: 23 pruebas correctas, build y typecheck correctos y auditoría npm con cero vulnerabilidades conocidas. Se instaló una copia con solo dependencias de producción y se verificó el handler compilado sin TypeScript ni tsx: health y catálogo responden, el perfil anónimo se rechaza y el evento incompatible devuelve JSON 400. Se generó un ZIP local de aproximadamente 3,9 MB, sin `.env`, código fuente del proyecto, tests ni los dos valores privados revisados. El ZIP y la carpeta de empaquetado se ignoran en Git. La política de ejecución bloqueó la limpieza de esa carpeta temporal; no se intentó eludirla.

Para probar JWT manualmente con Angular local, completar `COGNITO_USER_POOL_ID`, seleccionar `AUTH_MODE=jwt` en el `.env` del servidor y reiniciar la API. Conservar `NODE_ENV=development`, `AUTH_COOKIE_SAME_SITE=lax` y los orígenes locales. Para regresar al modo anterior, restaurar `AUTH_MODE=session`. No es necesario editar Angular ni cambiar su diseño.

## Empaquetado manual desde CloudShell

Estos pasos preparan un archivo local en CloudShell; no publican ni crean recursos. Primero trabajar en una copia limpia de `main` con estos cambios revisados y publicados por el usuario. No ejecutar pull sobre modificaciones locales sin revisarlas. Usar Node 24 compatible y entrar a `Back End`:

```bash
npm ci
npm test
npm run typecheck
iacv_package_dir="$(mktemp -d "$PWD/.lambda-package.XXXXXX")"
iacv_zip_path="$PWD/iarmatucv-lambda-$(date +%Y%m%d-%H%M%S).zip"
cp -R dist package.json package-lock.json "$iacv_package_dir/"
npm --prefix "$iacv_package_dir" ci --omit=dev
(cd "$iacv_package_dir" && zip -qr "$iacv_zip_path" dist node_modules package.json package-lock.json)
unzip -l "$iacv_zip_path"
```

El ZIP debe contener `dist/lambda.js`, las dependencias de ejecución y `package.json` con `type: module` en la raíz. No incluir `.env`, fuentes, tests ni carpetas superiores. Handler: **`dist/lambda.handler`**. Runtime objetivo: **Node.js 24.x**, a confirmar disponible en Academy. No empaquetar solo el handler: importa otros módulos y dependencias.

## Pendientes en AWS — no ejecutados

1. Confirmar permiso para Lambda Node 24, HTTP API y uso del rol preexistente LabRole. Para esta etapa no se necesita DynamoDB ni permisos Cognito Admin; revisar permisos mínimos de logs y las restricciones del laboratorio. No crear roles arbitrarios.
2. Autorizar la creación/configuración de la función y la API si todavía no existen. Cargar el ZIP y las variables del servidor. Mantener conectividad HTTPS hacia Cognito y su JWKS; no agregar VPC/NAT innecesarios.
3. Crear o revisar una integración HTTP API Lambda proxy con **payload 2.0**. Usar etapa `$default` y ruta `ANY /{proxy+}` para conservar `/api/v1/...`, o definir las rutas explícitas equivalentes. Confirmar el permiso de invocación limitado a la API real.
4. Dejar que Express gestione CORS, incluidos OPTIONS y errores. No duplicar una configuración diferente de CORS en Gateway. Admitir el origen HTTPS real, credenciales y encabezados Content-Type/Authorization. Nunca usar `*` junto a credenciales.
5. No aplicar un JWT authorizer de Gateway a todo el proxy: bloquearía registro e ingreso, y el authorizer estándar no extrae automáticamente el JWT de nuestra cookie. La validación de las rutas protegidas está implementada en Lambda. Si se adopta un authorizer adicional para rutas Bearer, aprobar primero esa configuración y mantener públicas las operaciones de alta y acceso.
6. Conservar el base path `/api/v1` visible al navegador. Si se usa una etapa nombrada o un mapeo de dominio, comprobar el `rawPath` del evento y ajustar encaminamiento y `AUTH_COOKIE_PATH` antes de publicar. Esta etapa prueba el contrato `$default` sin prefijo extra.
7. Configurar la URL HTTPS real de la API en el entorno de producción de Angular y recompilar. Mantener la URL vacía mientras la API no esté operativa.
8. Comprobar en HTTPS: preflight, registro/confirmación, ingreso, cookies HttpOnly/Secure, recarga, perfil protegido, vencimiento y salida. Desactivar caché de respuestas de `/api/*` y no registrar cookies, Authorization, contraseñas ni tokens en logs de Gateway/CloudFront.

Si ya existe una función y se autoriza una actualización, el comando manual será el siguiente; definir primero el nombre real, no inventarlo:

```bash
aws lambda update-function-code --function-name "${IACV_LAMBDA_NAME:?Definir nombre real autorizado}" --zip-file "fileb://$iacv_zip_path" --region us-east-1
```

Este comando no se ejecutó. Las variables privadas y los permisos no se incluyen en el ZIP ni en ese comando.

## Limitaciones

- Las cookies entre el dominio CloudFront y `execute-api` pueden bloquearse por políticas de terceros del navegador, incluso con SameSite=None. Preferir un encaminamiento HTTPS de `/api/*` bajo el mismo sitio mediante una opción permitida del laboratorio, pasando cookies/Authorization y sin cachear la API. No se modificó CloudFront aquí.
- La validación criptográfica de JWT no consulta una lista global de revocaciones. Las rutas de sesión y perfil además consultan `GetUser`, pero futuros endpoints que solo verifiquen JWT podrían aceptar un token revocado hasta su expiración. Definir TTL y revocación antes de implementar operaciones sensibles; no se agregó una lista en memoria que falle entre Lambdas.
- No hay renovación automática; al vencer el access token se requiere volver a ingresar. El modo Bearer requiere que el cliente descarte su token al salir; no se puede borrar un token guardado por otro cliente.
- MFA, passkeys y cambio de contraseña temporal continúan sin implementar; se rechaza el ingreso con esos desafíos, sin emitir cookies de acceso.
- No hay CRUD, persistencia, autorización de CV por propietario ni pruebas reales de despliegue. El login local funcional informado por el usuario se conserva y se verifica por regresión con Cognito simulado; no se repitieron operaciones reales sobre su cuenta.

## Referencias

- [Adaptador serverless-http](https://github.com/dougmoscrop/serverless-http)
- [Verificación Cognito aws-jwt-verify](https://github.com/awslabs/aws-jwt-verify)
- [Contrato HTTP API Lambda v2](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- [Runtime Node.js Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
