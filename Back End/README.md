# iArmatuCV — Back End

API REST con Node.js, Express 5, TypeScript 7 y dotenv 18.

Incluye dos entradas: servidor local `dist/server.js` y handler AWS Lambda `dist/lambda.handler` para API Gateway HTTP API payload v2. Se conserva Express. Ver [adaptación Node/Lambda, variables y empaquetado](../docs/Lambda-Node.md).

Requiere Node.js >=24.22.1 y <25. Compilación y ejecución verificadas con Node 24.22.1.

## Ejecutar

Desde esta carpeta:

```powershell
npm.cmd install
npm.cmd run dev
```

Para compilar: `npm.cmd run build`. Para ejecutar el compilado: `npm.cmd start`. Para verificar tipos sin generar archivos: `npm.cmd run typecheck`.

Para compilar y ejecutar la regresión: `npm.cmd test`. Las pruebas de Node incluyen JWT firmados con claves de prueba y Cognito simulado, sin operar sobre AWS.

La configuración local tiene valores por defecto. `.env.example` muestra las variables disponibles; las credenciales reales no se suben al repositorio.

## Organización

```text
src/
  server.ts       Inicia el servidor
  app.ts          Configura Express
  config/         Configuración local
  routes/         Métodos HTTP y rutas
  controllers/    Reciben solicitudes y devuelven respuestas
  services/       Operaciones de la aplicación
  repositories/   Acceso a los datos
  models/         Tipos de datos
  middlewares/    Manejo de errores
```

Se sigue la separación Router → Controller → Service → Repository trabajada en clase. El catálogo de plantillas se almacena en un array del repositorio, como en los ejemplos de la cursada. No es una conexión a PostgreSQL ni guarda currículums.

## Rutas disponibles

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/v1/health` | Estado de la API y nombre del servicio |
| GET | `/api/v1/plantillas` | Catálogo público de seis diseños |

Las respuestas usan `{ "data": ... }`. Los errores usan `{ "error": { "codigo": "...", "mensaje": "..." } }`. Las rutas inexistentes devuelven 404.

El frontend consume `/api/v1/plantillas` con HttpClient. Su URL se configura en el frontend y los orígenes permitidos se configuran mediante `FRONTEND_ORIGINS` en el backend.

## Pendiente

Modelo y operaciones CRUD de CV y persistencia según la entrega. Las rutas privadas se incorporarán con sus operaciones y controles de acceso. El despliegue AWS sigue pendiente.

## Acceso con Cognito

Se agregó `/api/v1/auth` para registro, confirmación, reenvío, ingreso, recuperación, nueva contraseña, consulta y cierre de sesión. Se utiliza el SDK oficial de Cognito y express-session. Las dependencias se agregaron mediante npm; no se copiaron las versiones antiguas ni el motor EJS del ejemplo.

Completar `COGNITO_CLIENT_SECRET` en `.env` si el app client tiene secreto. `AUTH_MODE=session` conserva la sesión local con `SESSION_SECRET`. `AUTH_MODE=jwt` usa cookies HttpOnly verificadas con Cognito y requiere `COGNITO_USER_POOL_ID`, sin Session Secret ni MemoryStore. Lambda y producción solo permiten JWT. No se requieren claves IAM permanentes. Reiniciar la API después de editar el archivo. `GET /api/v1/auth/perfil` exige autenticación; las rutas anteriores mantienen sus contratos. Consultar [Cognito](../docs/Cognito.md) y la [guía Lambda](../docs/Lambda-Node.md).
