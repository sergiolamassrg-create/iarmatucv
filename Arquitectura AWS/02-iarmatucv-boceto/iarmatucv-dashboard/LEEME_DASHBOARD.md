# iArmatuCV — Dashboard autenticado (Etapa 1)

Basado en el frontend de GitHub `sergiolamassrg-create/iarmatucv`, rama `main`, leído el 2026-11-04.

## Instalación recomendada

1. En la raíz del proyecto, comprobar que los cambios locales estén guardados (`git status`).
2. Descomprimir el ZIP **en una carpeta aparte** (no sobre el proyecto).
3. En PowerShell, desde la raíz del proyecto, ejecutar el script incluido indicando su ruta, por ejemplo:
   `& "C:\Descargas\iArmatuCV_Dashboard_Integracion\APLICAR_DASHBOARD.ps1"`
   Alternativamente, copiar los archivos de `Front End/` a las mismas rutas manualmente y agregar el enlace a `/panel` en `access.component.html`.
4. El script hace copia de los archivos que va a reemplazar en `respaldo-dashboard-AAAAMMDD-HHMMSS/` dentro del proyecto.
5. Ejecutar `npm.cmd run frontend:dev` y después `npm.cmd run build`. Entrar con una cuenta real en `/acceso` y verificar la redirección a `/panel`.

**Importante:** el script debe ejecutarse desde la raíz del proyecto, no desde la carpeta extraída. PowerShell puede tener restricciones de ejecución: si eso ocurre, copiar los archivos manualmente sin alterar la política global de seguridad.

## Qué hace

- `/panel` sólo se abre si el backend reporta sesión autenticada (guard cliente).
- La consulta inicial de sesión espera a concluir para evitar redirecciones prematuras al recargar.
- Después del login, Angular navega a `/panel`; el cierre de sesión usa el servicio existente.
- El dashboard usa los tokens de `src/styles.css`, DM Sans, Outfit y `hero-reference.png` ya existente.
- Incluye sidebar, navegación móvil, modo oscuro, progreso por pasos, tarjetas de acceso, estado vacío de CV y consejos generales.
- **No inventa CV guardados, porcentajes, IA funcional ni descarga de PDF.** Los controles de funciones futuras no hacen acciones engañosas.
- Mantiene intactos el backend y el contrato HTTP de autenticación existente.

## Limitaciones

- Los CV no tienen CRUD en la API todavía; el panel muestra estados vacíos intencionalmente.
- Esta guarda sólo protege la navegación en Angular. Los endpoints privados deben seguir validando la sesión JWT y la propiedad de cada CV en Express.
- No modifica la base de datos ni servicios de AWS.
- No se ejecutó el build en el entorno original; revisar versiones Angular y que `npm.cmd run build` termine correctamente.
- No se modificó GitHub remoto: el conector devolvió 403 al intentar crear una rama.
