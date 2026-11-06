# Perfil profesional — MVP

Se reutiliza Router → Controller → Service → Repository. El contrato se basa en `../Arquitectura AWS/05-backend/iarmatucv_db/perfil_ejemplo.json`; no se ejecutan las semillas ni los scripts Python.

## Rutas

| Método y ruta | Resultado |
|---|---|
| `GET /api/v1/perfil` | 200 `{data: perfil}`; 404 si el usuario todavía no tiene perfil |
| `PUT /api/v1/perfil` | Crea o reemplaza todas las secciones, 200 `{data: perfil}` |
| `DELETE /api/v1/perfil` | 204 sin cuerpo; también si ya estaba eliminado |

`/api/v1/auth/perfil` sigue siendo la consulta de identidad Cognito; no es el perfil profesional.

Las tres rutas requieren un **access token de Cognito** por `Authorization: Bearer ...` o cookie HttpOnly `iarmatucv.access`. Se reutilizan `requireAuth`, `readAuth` y el verificador existente de firma, emisor, vencimiento, uso del token y App Client. El `userId` de DynamoDB es únicamente el `sub` validado. No se confía en cabeceras de identidad ni claims de authorizer enviados por el cliente; no se añadió soporte para authorizer de API Gateway.

El identificador `DEMO_USER_SUB_REEMPLAZAR` se rechaza con 403 antes de acceder a DynamoDB. No se usa ningún perfil de ejemplo como respuesta alternativa.

Para PUT y DELETE con cookies se exige un Origin incluido en `FRONTEND_ORIGINS`. Bearer admite clientes sin Origin; si lo envían debe estar permitido. PUT requiere `application/json`. Las respuestas privadas incluyen `Cache-Control: no-store`.

## Cuerpo de PUT

Es un documento completo, no un PATCH. Deben estar presentes estos objetos:

- `datosPersonales`
- `perfilProfesional`
- `preferenciasPrivacidad`

Y estas listas de objetos, que pueden estar vacías:

- `experiencias`, `educacion`, `habilidades`, `idiomas`, `certificaciones`
- `proyectos`, `licencias`, `voluntariados`, `reconocimientos`

`camposPendientesDeValidacion` es una lista opcional de textos; si falta se guarda vacía. No enviar `userId`, `createdAt`, `updatedAt` ni `schemaVersion`: el servidor los administra y rechaza esos campos de entrada, igual que otros campos desconocidos en la raíz.

Se admiten objetos y listas vacíos para guardar un perfil incompleto. Los campos internos conservan sus valores y los `null` del ejemplo. Se validan los tipos de los campos conocidos, listas de textos, correo, enlaces HTTP/HTTPS sin credenciales y valores booleanos de privacidad. Las secciones sin definición detallada en el ejemplo admiten objetos JSON, sin inventar campos obligatorios. Los campos internos adicionales se conservan sujetos a los límites de JSON.

Límites: cuerpo de 32 KB (Express existente), textos de 5000 caracteres, listas de 100 elementos, objetos de 50 propiedades y profundidad máxima 8. Se rechazan claves `__proto__`, `prototype` y `constructor`. Los datos son texto, no HTML para renderizar sin escape. No se infieren ni completan datos profesionales.

La persistencia usa `DynamoDBDocumentClient`: GetItem por clave con lectura consistente, UpdateItem con `if_not_exists(createdAt, ...)` y DeleteItem. El PUT guarda `schemaVersion: 1`, conserva `createdAt` en la misma operación atómica y renueva `updatedAt` en UTC. Reemplaza cada sección completa; no combina elementos de las listas. Sin control de versiones del editor, gana la última escritura. No se usan Scan, Query, tablas de CV ni operaciones de infraestructura.

## Variables y permisos pendientes de comprobar en AWS

```dotenv
AWS_REGION=us-east-1
DYNAMODB_PERFILES_TABLE=iarmatucv-perfiles
AUTH_MODE=jwt
AUTH_COOKIE_PATH=/api/v1
```

`AWS_REGION` tiene por defecto `us-east-1`; el nombre de tabla no tiene valor por defecto. Sin tabla configurada, las rutas devuelven 503. Se mantienen las variables existentes de Cognito, cookies y `FRONTEND_ORIGINS`, documentadas en [README](README.md) y [Lambda](../docs/Lambda-Node.md).

El SDK usa la cadena de credenciales estándar. En Lambda debe utilizar el rol de ejecución, con `dynamodb:GetItem`, `dynamodb:UpdateItem` y `dynamodb:DeleteItem` restringidos a la tabla existente. No copiar `AWS_PROFILE` del ejemplo local a Lambda, ni incorporar claves AWS al código. No se crearon ni modificaron permisos.

Para probar localmente este CRUD con el login y cookies existentes, usar `AUTH_MODE=jwt` y reiniciar el backend. El login local con `AUTH_MODE=session` sigue intacto, pero su cookie de sesión no autentica estas nuevas rutas, que siempre exigen JWT. La conexión local real a DynamoDB requiere credenciales autorizadas y ejecuta operaciones reales; las pruebas automatizadas no las utilizan.

Fallos de configuración devuelven 503; indisponibilidad, falta de permisos y errores del SDK también devuelven 503 con mensaje genérico. No se devuelven detalles de AWS, credenciales ni contenidos del perfil en los errores.

## Verificación

Desde `Back End`:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Las pruebas simulan el cliente de DynamoDB y Cognito; los JWT se firman con claves RSA de prueba y se verifican criptográficamente sin red. Cubren CRUD, conservación del documento y fechas, separación entre usuarios, tokens inválidos, identidad demo, suplantación por cuerpo/cabeceras/query, validación, límites, Origin, fallos del SDK y eventos Lambda HTTP API v2.

El usuario confirmó las seis verificaciones de la prueba de lectura real con Cognito y DynamoDB, sin mocks. No se probó la escritura contra el registro real ni se desplegó. La [integración Angular](../docs/Perfil-Angular.md) consume GET/PUT; no ofrece eliminar el perfil completo. Antes de publicar quedan por comprobar la configuración del dominio, cookies/CORS y el enrutamiento de API Gateway.

### Prueba autenticada real de solo lectura

En la revisión del 5 de noviembre de 2026, el SDK resolvió el perfil local `iarmatucv-lab` y `DescribeTable` real confirmó `iarmatucv-perfiles` en estado ACTIVE, con clave `userId` de tipo String. Se corrigió el nombre incompleto de tabla en el `.env` local. Esto todavía no confirma el GET autenticado ni el permiso GetItem.

En una terminal PowerShell, desde `Back End`:

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

Mantener `COGNITO_USER_POOL_ID` y las otras variables de Cognito existentes en `.env`. En otra terminal, desde la misma carpeta:

```powershell
.\scripts\verificar-perfil-real.ps1
```

El script solicita las credenciales de Cognito mediante Get-Credential, inicia sesión, comprueba la cookie JWT, consulta la sesión y obtiene `/api/v1/perfil`. Verifica que el `userId` recibido coincide con la identidad autenticada y no es el identificador demo. Solo imprime un resumen booleano, sin contraseñas, tokens ni datos personales. No ejecuta PUT ni DELETE y no guarda credenciales en archivos. Si aparece un error, informa la etapa y el código público de la API. Requiere intervención del usuario para iniciar sesión; no reutiliza contraseñas del historial ni sustituye la prueba real por mocks.

La prueba autenticada fue confirmada por el usuario y permitió continuar con Angular. La consulta GetItem directa mediante AWS CLI, aunque sea exitosa, por sí sola no comprueba el recorrido completo Cognito → cookie → API → DynamoDB.

Referencia de implementación: [ejemplos oficiales del SDK de DynamoDB para JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_dynamodb_code_examples.html).
