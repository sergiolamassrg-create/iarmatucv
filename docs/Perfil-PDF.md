# Perfil de seis pasos y CV en PDF — MVP

## Auditoría y alcance

Se leyeron `README.md`, `CONTRATO_FUNCIONAL.md` y `PROMPT_CODEX.md` del paquete integral en `Arquitectura AWS/02-iarmatucv-boceto/iarmatucv-perfil`, junto con su prototipo e imágenes. Se conservaron los originales y el trabajo local existente. El repositorio usa Angular 22, no Angular 19; no se cambiaron sus versiones ni la arquitectura.

El editor ya tenía seis pasos, campos reutilizables, GET/PUT con cookies JWT, estados de carga/404/401/error, borradores parciales, listas y confirmación de salida. Se reutilizaron. El componente de la galería contiene ejemplos ilustrativos de plantillas; no procesa el perfil real y no es un generador PDF. Por eso se agregó una vista de CV con el contrato real, sin reemplazar la galería o su selección de diseños.

Se mantiene el perfil en DynamoDB como fuente de información. El CV es una composición local del perfil: no se creó una tabla, modelo de persistencia ni CRUD de currículums. No se modificaron backend, autenticación ni infraestructura en esta ampliación.

## Funcionamiento

1. Iniciar sesión, abrir «Mi perfil» y completar cualquiera de los seis pasos.
2. «Guardar perfil» usa el PUT existente. Se preservan las trece secciones y sus campos internos no visibles; no se envían userId, fechas ni versión del servidor.
3. Al recargar, el GET existente recupera el documento guardado. Un perfil ausente permite empezar vacío.
4. «Vista previa» abre la pantalla final. También se accede desde el panel mediante `/panel/perfil?vista=cv`.
5. Elegir las secciones y datos de contacto a incluir. Los vacíos se omiten; no se inventan experiencia, títulos, fechas ni información personal.
6. «Generar PDF» abre `window.print()`. Elegir **Guardar como PDF**, papel **A4**, escala normal y desactivar los encabezados/pies del navegador. No hay descarga automática ni confirmación de que el usuario haya guardado el archivo.

La exportación requiere nombre y apellido. El título y resumen son recomendados; no se exige experiencia, educación ni otras secciones opcionales. Los borradores parciales se siguen pudiendo guardar aunque todavía no puedan exportarse. Los errores de formato de los campos existentes llevan al paso que debe revisarse.

La selección del CV no modifica el perfil, no se envía al PUT y no se persiste entre recargas. Se conserva al guardar dentro del editor. El teléfono toma inicialmente `mostrarTelefono`. La ubicación completa toma `mostrarUbicacionCompleta`; si está desactivada, solo se incluye el país. Los controles permiten cambiar explícitamente esas opciones para el CV o quitar ubicación, correo y enlaces. Las secciones desmarcadas no se renderizan en el documento.

La vista previa usa el borrador actual, incluidos cambios sin guardar, y muestra un aviso en ese caso. Imprimir no guarda el perfil. El progreso se calcula desde datos reales: nombre y apellido, título y resumen, experiencias, educación, habilidades e información adicional. Es un indicador de secciones con información, no una exigencia de completar campos opcionales.

El documento ofrece [ATS Clásica y Profesional Moderna](Plantillas-CV.md), con enlaces clicables, habilidades compactas y orden de secciones personalizable. La ATS usa una columna; la moderna agrega un lateral visual. Los valores se renderizan mediante interpolación Angular, sin HTML ingresado por el usuario. Solo se exportan campos profesionales conocidos; se omiten metadatos, identificadores internos, preferencias y datos pendientes. La impresión usa A4 con márgenes de 16 mm y oculta navegación, controles y editor. No se envían datos a terceros ni se agregaron dependencias para PDF.

## Archivos de esta ampliación

| Archivo | Cambio |
|---|---|
| `Front End/src/app/core/models/cv-document.ts` | Composición del CV, opciones, validación de exportación y progreso |
| `Front End/src/app/features/profile/profile-cv.component.ts`, `.css` | Documento con datos reales, estilos de pantalla e impresión |
| `Front End/src/app/features/profile/profile.component.ts`, `.html`, `.css` | Pantalla final, selección, impresión y navegación desde los seis pasos |
| `Front End/src/styles.css` | Reglas de impresión limitadas al modo de exportación |
| `Front End/src/app/features/dashboard/dashboard.component.html` | Accesos a preparar CV y vista previa/PDF; textos de estado actualizados |
| `Front End/src/app/features/access/access.component.html` | Descripción del acceso acorde al alcance implementado |
| `Front End/tests/cv-document.test.mjs` | Pruebas del documento, privacidad, selección y progreso |
| `README.md`, `Front End/README.md`, `docs/Dashboard.md`, `docs/Perfil-Angular.md`, este archivo | Alcance vigente y procedimiento |

## Verificaciones

Desde `Front End`:

```powershell
node --test tests/*.test.mjs
npm.cmd run typecheck
npm.cmd run build
```

Desde `Back End`:

```powershell
npm.cmd test
npm.cmd run typecheck
```

Pruebas del navegador con respuestas controladas: carga automática, login, GET/PUT y recarga, ausencia de perfil, 401, error/reintento, validación, listas, conservación de campos ocultos y null, confirmación de salida, cambios de paso, privacidad y selección del CV, conservación de la selección después de guardar y borrador sin apellido guardable pero no exportable. Temas claro/oscuro y anchos 320, 390, 768, 1024 y 1440 sin desbordamiento horizontal ni excepciones.

Se generaron PDFs con el motor real de impresión de Chromium y datos ficticios: se comprobaron dimensiones A4, texto seleccionable, omisión de menús/controles/secciones excluidas y contactos privados, márgenes y un documento de cinco páginas con todos sus puestos recuperables y sin páginas vacías. Se comprobó que HTML ingresado en el resumen permanece como texto y no se ejecuta.

La lectura real Cognito → Express → DynamoDB fue confirmada por el usuario en la etapa anterior. No se probó escritura sobre su registro real ni se sustituyó esa prueba por un mock afirmando que fuera integración real. Tampoco se realizó un despliegue.

## Prueba manual y pendientes

Usar los comandos y variables de [Perfil-Angular.md](Perfil-Angular.md) para iniciar backend JWT y Angular. Abrir `http://127.0.0.1:4200/acceso`, ingresar, revisar el perfil recuperado y recorrer los pasos. Para confirmar una escritura real hace falta una prueba manual autorizada: modificar un campo, guardar, recargar y verificar que el valor y las demás secciones se conservan. No usar el registro demo ni datos ajenos.

Abrir la vista previa, desmarcar una sección y verificar que desaparece; generar el PDF y revisar el destino y el documento en el diálogo de Chrome/Edge. Ese diálogo y la ubicación del archivo dependen del navegador y del sistema. No se garantiza compatibilidad de impresión con todos los navegadores.

Quedan pendientes múltiples CV guardados, aplicar los restantes diseños de la galería, fotos e IA. Ya están implementadas las variantes ATS y Moderna, con sus [pruebas y límites documentados](Plantillas-CV.md). Para publicar faltan la configuración de API de producción de esta copia, cookies/CORS en el dominio final y la resolución SPA de `/panel/perfil`; no se operó sobre AWS. La URL de producción sigue vacía y las solicitudes quedan bloqueadas de forma controlada hasta configurarla.

Referencias técnicas: [impresión CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) y [window.print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print).
