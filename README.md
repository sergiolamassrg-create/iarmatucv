# iArmaTuCV

Aplicación con Angular 22, Express 5, Cognito y DynamoDB, preparada para Amplify y Lambda Node.js. Requiere Node 24.22.1 y npm; cada aplicación conserva su `package-lock.json`.

Las correcciones actuales se implementaron y probaron localmente. **Falta publicarlas y comprobar la configuración/permisos de AWS Academy.** No se crearon recursos ni se modificaron cuentas reales durante las pruebas automatizadas.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `Front End/` | Angular, pantallas, formularios, PDF y widget Milo |
| `Back End/` | API Express, entrada Lambda, Cognito, DynamoDB y agente Milo |
| `docs/` | JSON de referencia para el proxy y permisos de administración |
| `IA/Agentes/Milo/` | Único ZIP acumulativo de integración |
| `scripts/` | Generación del ZIP desde las fuentes |
| `Arquitectura AWS/` | Bocetos, ejemplos y recursos originales de referencia; no son la aplicación publicada |

Este README concentra la documentación vigente. El código y los modelos de cada aplicación definen el contrato real.

## Ejecutar localmente

Desde la raíz, instalar dependencias:

```powershell
npm run install:all
```

En una terminal:

```powershell
npm run backend:dev
```

En otra:

```powershell
npm run frontend:dev
```

Abrir `http://127.0.0.1:4200`. La API escucha en `http://127.0.0.1:3000`; Angular usa `/api/v1` mediante `Front End/proxy.conf.json`. El healthcheck está en `/api/v1/health`: confirma que Express responde, no que Cognito o DynamoDB estén disponibles.

Para trabajar dentro de una aplicación, usar sus propios comandos: `npm run dev` desde `Back End` y `npm start` desde `Front End`. No repetir `--prefix "Back End"` si la terminal ya está dentro de esa carpeta.

## Configuración privada

Usar `Back End/.env.example` como referencia para el `.env` privado del backend. Conservar los identificadores y credenciales existentes; reiniciar backend después de cambiar variables. No poner secretos en Angular, Git, logs ni ZIP.

| Variables | Uso |
| --- | --- |
| `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET` | Pool y app client existentes; secreto solo si corresponde |
| `AUTH_MODE=jwt` | Autenticación JWT; obligatoria en Lambda/producción |
| `FRONTEND_ORIGINS` | Orígenes exactos permitidos; incluir el dominio de Amplify en producción |
| `AWS_REGION`, `DYNAMODB_PERFILES_TABLE` | Región y tabla de perfiles existentes |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `MILO_AGENT_ENABLED=true` | Activación del agente Milo |
| `MILO_TABLE_NAME` | Opcional: tabla del estado de Milo; por defecto se usa la de perfiles |
| `APP_ADMIN_EMAILS` | Correos administradores separados por comas, verificados por Cognito |

Para generar CV con varias experiencias, `MILO_AGENT_MAX_OUTPUT_TOKENS` usa 4096 por defecto (máximo configurable: 8192). Si el entorno conserva el valor anterior 700, actualizarlo a 4096 y reiniciar o publicar el backend. No confundirlo con `MILO_MAX_OUTPUT_TOKENS`, del flujo anterior. Las respuestas incompletas no ejecutan herramientas; el evento `MILO_GEMINI_RESPONSE_REJECTED` distingue `MAX_TOKENS`, `MALFORMED_FUNCTION_CALL`, bloqueos y `EMPTY_RESPONSE` sin registrar contenido ni datos personales. Una propuesta validada conserva su revisión y confirmación obligatoria aunque el mensaje final de Gemini llegue vacío. No se agregaron reintentos automáticos.

Las cuotas y límites técnicos configurables del agente también están en `.env.example`. El SDK usa la cadena estándar de credenciales AWS: perfil temporal autorizado en desarrollo y rol de ejecución en Lambda. No copiar `AWS_PROFILE` ni claves temporales del laboratorio a Lambda. El login real y la persistencia requieren servicios/configuración válidos; las pruebas automatizadas usan simulaciones.

## Funciones y autenticación

- Acceso con registro, confirmación, login, recuperación y logout mediante Cognito.
- Perfil profesional propio, editor por secciones y PDF mediante impresión del navegador, con plantillas ATS Clásica y Profesional Moderna.
- Mis CV: crear, duplicar, editar y exportar versiones independientes, compartiendo datos personales del perfil. Cada versión guarda su elección entre ATS Clásica y Profesional Moderna: cambiar el diseño no duplica el CV ni modifica su contenido. El nombre interno del CV no se imprime; el cargo profesional es un campo opcional separado.
- Milo: ventana ampliable, historial persistente, consulta profesional de la cuenta autenticada y propuestas de CV o cambios de perfil con revisión y confirmación humana.
- Administración básica: cuentas registradas y habilitación/deshabilitación con confirmación. Muestra datos mínimos de cuenta, sin leer ni editar los CV ajenos. Los contadores corresponden a la página actual, no a actividad o usuarios conectados.

El access JWT vive solo en memoria y se envía como Bearer. Al recargar, Angular espera `POST /api/v1/auth/renovar`; una cookie HttpOnly, Secure, SameSite=Strict y host-only recupera la sesión. La cookie `__Secure-iarmatucv.renew` tiene Path `/api/v1/auth` y su valor no se expone a JavaScript ni al JSON. Esto necesita una API de **mismo origen**, mediante el proxy local o el proxy HTTPS de Amplify.

No se guardan JWT en localStorage/sessionStorage. LocalStorage conserva la preferencia de tema y un indicador no secreto de logout para evitar recuperar una sesión cerrada sin conexión. Los errores transitorios conservan la cookie y ofrecen reintento; una sesión vencida exige login sin bucles. Recargar no conserva formularios que todavía no se hayan guardado.

Cada petición protegida valida la firma del JWT y consulta el estado de Cognito, para rechazar cuentas deshabilitadas/revocadas aunque el token aún no haya vencido. El propietario siempre sale de la identidad validada, no de un `userId`, correo o rol enviado por el cliente.

El administrador se identifica con `APP_ADMIN_EMAILS` y el correo verificado devuelto por Cognito. No consume las cuotas internas de consultas de Milo por minuto/día; otros usuarios sí. Se mantienen la exclusión de operaciones simultáneas y los límites técnicos y de Google. El chat inicial `/api/v1/milo/chat` se conserva para desarrollo, con `MILO_ENABLED`; el widget actual usa `/api/v1/milo/agente` y `MILO_AGENT_ENABLED`.

## API y datos

| Ruta | Uso |
| --- | --- |
| `/api/v1/health`, `/api/v1/plantillas` | Consultas públicas |
| `/api/v1/auth/*` | Acceso, renovación, registro y recuperación |
| `/api/v1/perfil` | GET/PUT/DELETE del perfil propio |
| `/api/v1/curriculums` | Biblioteca de CV propios; detalle/edición por id y duplicación |
| `/api/v1/milo/agente/*` | Conversación, mensajes, propuestas y confirmaciones |
| `/api/v1/admin/usuarios` | Listado paginado de cuentas, solo administrador |
| `/api/v1/admin/usuarios/:id/estado` | PUT con `{ "habilitado": true }` o `false`, solo administrador |

El perfil usa la clave `userId` existente. Su PUT reemplaza el documento de entrada completo: objetos `datosPersonales`, `perfilProfesional`, `preferenciasPrivacidad`; listas `experiencias`, `educacion`, `habilidades`, `idiomas`, `certificaciones`, `proyectos`, `licencias`, `voluntariados`, `reconocimientos`; y `camposPendientesDeValidacion` opcional. Los metadatos de propietario, versión y fechas los administra el servidor. El contrato está en `Back End/src/models/professional-profile.ts` y su validación en `services/profile.service.ts`.

Milo guarda su estado y los CV en registros técnicos con prefijo reservado, aislados por usuario. No hace falta recrear tablas ni modificar la clave de DynamoDB. Las propuestas vencen y requieren confirmación; la edición verifica versiones para evitar aplicar propuestas sobre contenido que cambió. Los errores públicos omiten credenciales y contenidos privados. Las consultas a Gemini se procesan fuera de AWS; evitar datos sensibles y revisar el plan/límites de la cuenta del proveedor.

## Verificar

Desde `Back End`:

```powershell
npm test
npm run typecheck
```

Desde `Front End`:

```powershell
npm run build
node --test tests/*.test.mjs
```

Con ambas aplicaciones compiladas y Chrome instalado, desde `Back End`:

```powershell
node tests/browser-auth.mjs
node tests/browser-milo-agent.mjs
```

Última validación: **101 pruebas backend, 33 frontend y 23 escenarios en Chrome**, con compilaciones correctas. Incluyen guardar y recuperar la plantilla elegida y generar ambos diseños de PDF para el mismo CV. Las pruebas usan Cognito/DynamoDB/Gemini simulados y JWT con claves sintéticas; no generan contenido real de Gemini ni modifican cuentas reales. `Back End/scripts/verificar-gemini.mjs` es una herramienta manual aparte que consulta el catálogo de Google, sin generar respuestas.

## Integración de Milo

El único paquete es `IA/Agentes/Milo/Integracion-Milo-Completa.zip`, con las fuentes acumuladas desde la integración inicial hasta el perfil, varios CV, recuperación de sesión y administración. Incluye `README.md`, `MANIFIESTO.json` y archivos actuales bajo `archivos/`, sin credenciales, compilados, dependencias instaladas ni ZIP anidados.

**No se sube directamente a Lambda ni a Amplify.** Es para integrar en un proyecto compatible con la estructura actual. Comparar y combinar rutas, dashboard, estilos, autenticación y manifiestos si el proyecto receptor tiene personalizaciones. El backend completo se incluye como referencia; no reemplazar código propio sin revisarlo.

Para regenerarlo desde la raíz:

```powershell
python scripts/empaquetar-milo.py
```

Después de integrar sus fuentes, usar `npm ci` en cada aplicación para instalar las versiones de sus lockfiles y ejecutar las verificaciones anteriores. El avatar está en `Front End/public/assets/milo/Milo.png`.

## Publicación en AWS Academy

Publicar primero el backend, configurar/verificar el proxy y luego publicar el frontend. Conservar la función Lambda, API Gateway, pool y tabla existentes; no crear servicios nuevos.

1. Compilar y empaquetar el backend receptor con `dist/`, `package.json` y dependencias de producción, excluyendo `.env` y herramientas de desarrollo. Subirlo a la Lambda existente; el handler es `dist/lambda.handler`, para HTTP API v2 y runtime compatible con Node 24. Si la integración usa un alias, actualizar ese mismo alias según el flujo del proyecto.
2. Conservar variables y rol; configurar `APP_ADMIN_EMAILS` con el correo administrador verificado y `FRONTEND_ORIGINS` con el origen exacto `https://main.d3ugtaj51p0x9w.amplifyapp.com`. Los parámetros privados de Cognito, Gemini y DynamoDB permanecen en Lambda, no en el frontend.
3. En Amplify existente: Hosting → Rewrites and redirects → Manage redirects. Agregar la entrada de [regla de proxy](docs/Amplify-api-proxy.regla.json) **antes del fallback SPA y reglas generales**, conservando el resto:

   ```json
   {
     "source": "/api/v1/<*>",
     "target": "https://w6og1akmjh.execute-api.us-east-1.amazonaws.com/api/v1/<*>",
     "status": "200",
     "condition": null
   }
   ```

4. Hosting → Custom headers and cache → Cache key settings: comprobar **Keep cookies in cache key**. No sustituir `Cache-Control: no-store` de las respuestas privadas/autenticación. Verificar que `https://main.d3ugtaj51p0x9w.amplifyapp.com/api/v1/health` devuelva **200 JSON**, sin redirección ni HTML, antes de publicar el frontend nuevo.
5. Para listar/habilitar/deshabilitar cuentas, el rol existente debe permitir `cognito-idp:ListUsers`, `cognito-idp:AdminEnableUser` y `cognito-idp:AdminDisableUser` sobre el pool existente. La [política mínima de referencia](docs/Admin-Cognito-permisos.ejemplo.json) contiene marcadores que deben reemplazarse por cuenta/pool reales. Si Academy deniega esos permisos, el panel devuelve `ADMIN_PERMISOS_AWS`; no se resuelve cambiando el frontend ni creando otro rol automáticamente.
6. Compilar Angular y publicar únicamente el contenido de `Front End/dist/iarmatucv/browser/`, con `index.html` en la raíz del paquete. Usar el flujo de la misma aplicación/rama de Amplify; si está conectada a Git, conservar ese flujo.

Los JSON son referencias para revisión manual; subir archivos estáticos no configura el proxy ni IAM. No se verificaron ni aplicaron esos permisos remotamente. La configuración real de AWS Academy queda pendiente de validación.

Después de publicar: ingresar una vez, recargar perfil y CV sin perder sesión, probar Milo y un PDF, cerrar sesión y recargar para confirmar el cierre. Con el administrador, verificar cuentas de prueba y habilitación/deshabilitación; con un usuario normal, comprobar rechazo de administración y aislamiento de sus CV. No operar sobre cuentas reales de terceros para estas pruebas sin autorización.
