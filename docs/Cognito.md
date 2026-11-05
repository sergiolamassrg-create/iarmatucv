# Acceso con Amazon Cognito

La interfaz de `/acceso` usa el User Pool existente a través de la API Express que actualmente ejecuta esta carpeta. Conserva el diseño propio; no redirige al login administrado ni usa EJS. Esta implementación local no sustituye la futura adaptación del backend a Python/Lambda para la entrega AWS.

## Configuración local

Se creó `Back End/.env`, excluido de Git. `Back End/.env.example` contiene los nombres de las variables, sin secretos:

- `COGNITO_REGION`: `us-east-1`.
- `COGNITO_CLIENT_ID`: ID del app client del adjunto.
- `COGNITO_CLIENT_SECRET`: completar con el **Client Secret del app client**, si tiene uno; dejar vacío solamente si ese cliente no tiene secreto. No es una Access Key ni una Secret Access Key de IAM.
- `SESSION_SECRET`: secreto aleatorio local ya generado; conservarlo. Para una instalación nueva generar al menos 32 bytes aleatorios.
- `FRONTEND_ORIGINS`: orígenes exactos permitidos. En desarrollo se incluyen `http://127.0.0.1:4200` y `http://localhost:4200`.
- `NODE_ENV`: `development` para ejecución local.

No colocar el Client Secret ni claves AWS en Angular, archivos públicos, capturas o commits. No se requieren credenciales IAM para las operaciones de usuarios implementadas.

## Revisar en Cognito

En el User Pool `us-east-1_ULwOvMrHA`, revisar el app client `7vdociammjejng2m4ipi25td71`:

1. Permitir el flujo `ALLOW_USER_PASSWORD_AUTH` para el ingreso desde el servidor. El ejemplo OAuth del adjunto por sí solo no garantiza que este flujo esté habilitado.
2. Para registro desde la aplicación, habilitar autorregistro y configurar verificación y recuperación por correo. La pantalla de alta del User Pool solicita `name`, `family_name` y `nickname` además del correo y contraseña: el formulario propio ahora pide nombre completo, apellido y nombre para mostrar. El app client debe permitir escribir esos atributos y `email`.
3. Revisar la política real de contraseñas. La interfaz valida un mínimo de ocho caracteres; Cognito aplica su política definitiva.
4. Si el pool exige MFA, passkeys o cambio obligatorio de contraseña temporal, la aplicación informa que falta ese paso y no abre una sesión. Esos desafíos necesitan una ampliación del flujo.

No se cambió la configuración de AWS ni se crearon usuarios durante la implementación. La conexión pública de descubrimiento OIDC del User Pool respondió HTTP 200; eso no valida el secreto, los flujos ni el envío de correos.

## Ejecutar y comprobar con una cuenta propia

Después de completar `.env`, reiniciar el backend para que lea los valores nuevos. Usar el lanzador de la raíz o los comandos habituales en dos terminales:

```powershell
npm.cmd run backend:dev
npm.cmd run frontend:dev
```

Abrir `http://127.0.0.1:4200/acceso`. Usar el mismo nombre de host al navegar: no alternar `localhost` y `127.0.0.1`. El registro tiene dos pasos: datos de la persona y luego correo/contraseña; recién al completar el segundo se llama a Cognito. Los datos se mantienen solo en memoria durante ese formulario. Registrar una cuenta propia, confirmar su código, ingresar, recargar para comprobar la sesión y cerrar sesión. Recuperación solicita otro código y permite establecer una contraseña nueva.

## API y sesión

Todas las rutas están bajo `/api/v1/auth`:

| Método | Ruta | Operación |
|---|---|---|
| GET | `/sesion` | Devuelve usuario autenticado o `null` |
| POST | `/registro` | Registro con `name`, `familyName`, `nickname`, `email`, `password` |
| POST | `/confirmacion` | Confirmación con `email`, `code` |
| POST | `/reenviar-codigo` | Nuevo código de confirmación con `email` |
| POST | `/ingreso` | Ingreso con `email`, `password` |
| POST | `/recuperacion` | Solicitud de recuperación con `email` |
| POST | `/restablecer` | Nueva contraseña con `email`, `code`, `password` |
| POST | `/salida` | Destruye la sesión local y solicita revocación del refresh token |

Los POST requieren JSON y un encabezado `Origin` incluido en `FRONTEND_ORIGINS`; Angular los envía desde el navegador. Las respuestas no incluyen contraseñas, secretos ni tokens. El servidor comprueba el access token con `GetUser`, regenera la sesión al ingresar y devuelve una cookie HttpOnly con SameSite=Lax. No se guardan tokens en localStorage. Al vencer el access token se requiere un nuevo ingreso; todavía no hay renovación automática. Los mensajes de recuperación no confirman si existe una cuenta.

## Antes del despliegue

La sesión usa el MemoryStore de express-session para desarrollo: se pierde al reiniciar y no sirve para producción distribuida ni Lambda. Para desplegar se debe implementar la estrategia de sesión del backend de destino y su almacenamiento, usar HTTPS y configurar correctamente proxy, cookies y orígenes. El frontend debe apuntar a la API desplegada, no a `127.0.0.1`. Para el esquema de cookies actual, servir el frontend y `/api` bajo el mismo sitio, por ejemplo mediante comportamientos de CloudFront. La disponibilidad del frontend estático en CloudFront no publica automáticamente el backend.

## Referencias

- https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html
- https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_SignUp.html
- https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html
- https://expressjs.com/en/resources/middleware/session/
