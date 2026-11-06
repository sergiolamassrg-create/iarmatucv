# Plantillas de CV: ATS Clásica y Profesional Moderna

## Qué se corrigió

El generador anterior ya componía un documento con datos del perfil, pero tenía una única presentación, cada habilidad ocupaba varios renglones y los enlaces no tenían destinos clicables. Las secciones no se podían reordenar. Además, al imprimir con fondos activados desde el tema oscuro, los márgenes podían heredar un fondo oscuro.

Se revisó `C:/Users/Sergio/Downloads/CV_Moderno` como referencia de solo lectura. Su diseño de cabecera y columna lateral se adaptó a los colores actuales. No se copiaron sus datos ilustrativos, altura A4 fija, pie absoluto ni `overflow:hidden`: esas reglas podían recortar el contenido extenso.

Se conservaron Angular 22, rutas, autenticación, servicio GET/PUT y modelo del perfil. No se agregaron dependencias, generadores externos, infraestructura ni escrituras sobre datos reales.

## Opciones disponibles

| Plantilla | Presentación | Uso |
|---|---|---|
| ATS Clásica | Una columna, encabezados convencionales, texto y habilidades compactas; sin foto ni iconos | Predeterminada; prioriza el orden de lectura |
| Profesional Moderna | Cabecera con iniciales del nombre, acentos de la paleta y lateral de contacto, habilidades e idiomas | Alternativa visual; las columnas pueden ser menos compatibles con algunos ATS |

Ambas usan el mismo `CvDocument`, las mismas secciones e información. Los nombres, puestos, fechas, instituciones, habilidades y enlaces siguen siendo texto real, no imágenes. Los iconos de la moderna acompañan al texto y no lo sustituyen. No se genera fotografía ni se reserva espacio para una foto ausente.

La pantalla final permite elegir plantilla, ocultar secciones/contactos y subir o bajar secciones. La ATS respeta el orden completo. En la moderna, contacto/habilidades/idiomas permanecen en el lateral y el orden elegido se respeta dentro de cada columna; esa limitación se informa en la interfaz.

Las opciones del CV son locales al editor, se conservan al guardar el perfil y se reinician al recargar. No se envían a DynamoDB ni modifican el perfil porque un dato esté oculto. Los campos no editados del perfil se siguen preservando mediante el borrador existente.

## A4, enlaces y paginación

Se mantiene la impresión nativa: A4 vertical de 210 × 297 mm, márgenes de 16 mm, Arial/Helvetica, cuerpo de 10.5 pt y contacto/lateral de al menos 9.5 pt. Se compactaron espacios y habilidades, sin reducir dinámicamente la tipografía ni recortar información para forzar una página.

La presentación no impone altura fija ni oculta desbordamientos. Cuando el contenido no entra, continúa en páginas A4. Las entradas habituales intentan mantenerse juntas; una entrada mayor que una página puede dividirse. Los encabezados de sección intentan permanecer junto al contenido siguiente.

El modo de impresión fuerza papel blanco, incluso desde el tema oscuro. La moderna usa un lateral claro con texto oscuro al imprimir para mantener legibilidad sin depender de los gráficos de fondo. Se ocultan menú, botones, editor y controles.

Los contactos usan enlaces HTTP/HTTPS, mailto o tel según el dato, sin contraseñas incrustadas ni protocolos ejecutables. Los enlaces web de proyectos y otras entradas también son clicables. Los valores se renderizan como texto mediante Angular; no se interpreta HTML aportado por el usuario.

«Generar PDF» abre la impresión del navegador. Elegir **Guardar como PDF**, A4 vertical, escala 100 % y **desactivar encabezados y pies del navegador**. La app no agrega URL, fecha ni numeración; las cabeceras propias del navegador dependen de ese ajuste y no se pueden desactivar de forma portable desde window.print. No se afirma que exista una descarga directa automática.

## Verificaciones técnicas

Se usó el motor real de impresión de Chromium, con perfiles representativos ficticios y sin escribir en AWS:

En esta revisión pasaron la compilación y el chequeo de tipos de Angular/Express, 15 pruebas del frontend y 48 del backend (incluyendo las pruebas existentes de los cambios paralelos). Se conservaron esos cambios y no se modificó la implementación de Milo.

| Caso | ATS | Moderna |
|---|---:|---:|
| Moderado: resumen, una experiencia, dos estudios, ocho habilidades, idioma, certificación y proyecto | 1 página | 1 página |
| Veinte experiencias extensas | 4 páginas | 6 páginas |
| Una experiencia con 60 responsabilidades y 100 habilidades | 6 páginas | 7 páginas |
| Solo nombre y apellido, sin contacto ni secciones adicionales | 1 página | 1 página |

Se comprobaron las dimensiones A4 en todas las páginas, márgenes blancos, bloques de texto dentro de los márgenes, ausencia de páginas vacías, conservación de los puestos/responsabilidades/habilidades y omisión de navegación y secciones ocultas. No se garantiza una sola página para cualquier cantidad de datos.

Se extrajo texto con PyMuPDF: nombres y acentos como «María José Núñez», «Automatización» e «Inglés» se conservaron. En la ATS se verificó el orden nombre → contacto → perfil → experiencia → educación → habilidades → idiomas → certificaciones → proyectos. El orden personalizado se comprobó en DOM y PDF.

Ambos PDF moderados contienen seis destinos clicables verificados: correo, teléfono, LinkedIn, GitHub, portfolio y proyecto. Se revisaron anchos de 320, 390, 768 y 1440 píxeles sin desbordamiento horizontal, y la regresión del editor en ambos temas. En móvil la vista moderna se apila para poder leerla; al imprimir vuelve a su distribución A4 de dos columnas.

La extracción y las comprobaciones estructurales son pruebas técnicas, **no una certificación o garantía de aprobación ATS**. No se envió el perfil a un ATS de terceros ni se comprobó cada lector PDF, navegador o dispositivo. Para un sistema de selección desconocido se recomienda la ATS Clásica.

Los ejemplos de verificación están en `.verificacion-browser/cv-ats-moderado.pdf` y `cv-moderna-moderado.pdf`, con sus capturas PNG y casos extensos. Son artefactos locales ignorados por Git y contienen datos ficticios. La exportación con el perfil real se puede revisar manualmente después de iniciar sesión; estas pruebas no usaron ni sobrescribieron el registro real.

## Archivos de esta mejora

- `Front End/src/app/core/models/cv-document.ts`: catálogo de plantillas, orden de secciones y destinos de enlaces seguros.
- `Front End/src/app/features/profile/profile-cv.component.ts`, `.html`, `.css`: composición compartida, variantes ATS/moderna, habilidades compactas y estilos A4.
- `Front End/src/app/features/profile/profile.component.ts`, `.html`, `.css`: selector de plantilla, controles de orden y modo de impresión claro.
- `Front End/src/app/shared/ui-icon/ui-icon.component.ts`: iconos discretos reutilizables de contacto.
- `Front End/src/styles.css`: fondo y esquema claro exclusivos de impresión.
- `Front End/tests/cv-document.test.mjs`: pruebas de orden, opciones independientes del perfil y destinos seguros.
- `README.md`, `Front End/README.md`, `docs/Perfil-PDF.md` y este documento: alcance, resultados y limitaciones.

Para sumar una plantilla se extienden el catálogo tipado y la presentación del mismo componente; no se duplica el mapeo del perfil ni el servicio HTTP.

## Comandos y prueba manual

Desde `Front End`:

```powershell
node --test tests/*.test.mjs
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

Desde `Back End`:

```powershell
npm.cmd test
npm.cmd run typecheck
```

Iniciar el backend JWT con la configuración existente, entrar a `/panel/perfil?vista=cv`, comparar ambas plantillas, reordenar una sección y generar el PDF. Revisar enlaces y páginas en el lector PDF. No hace falta guardar el perfil para comparar diseños. No se desplegó ni se cambiaron recursos o permisos AWS.

Pendientes: persistir varios CV y sus preferencias como entidades separadas, aplicar los restantes diseños de la galería, foto opcional y pruebas con plataformas ATS específicas. La publicación conserva los pendientes de API de producción, cookies/CORS y rutas SPA documentados en [Perfil-PDF.md](Perfil-PDF.md).
