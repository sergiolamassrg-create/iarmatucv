# IACV-AF-001 — Especificación de requisitos y alcance funcional

| Campo | Valor |
|---|---|
| Proyecto | iArmatuCV |
| Código | IACV-AF-001 |
| Versión | 1.0 — línea base propuesta |
| Fecha | 2026-10-23 |
| Estado | Borrador para revisión funcional; no implica implementación |
| Disciplina | Análisis funcional / ingeniería de requisitos |
| Audiencia | Equipo, docente, analista funcional, desarrollo y Codex |
| Referencias metodológicas | Estructura inspirada en ISO/IEC/IEEE 29148 (ingeniería de requisitos); **no constituye certificación de conformidad** |
| Documento relacionado | `../01-arquitectura/IACV-ARC-002_Arquitectura_Tecnica_AWS.md` |

## 1. Objetivo del documento

Establecer la necesidad de negocio, actores, alcance, límites, reglas, requisitos funcionales (RF) y no funcionales (RNF), criterios de aceptación y decisiones abiertas de **iArmatuCV**. Es una referencia funcional transversal para frontend, backend, datos, infraestructura y QA. **No define código, componentes Angular, clases Python, endpoints definitivos ni diseño visual detallado**; esos artefactos se mantienen en sus documentos especializados.

**Regla para Codex:** no interpretar requisitos marcados *Pendiente* o *Futuro* como autorización para implementar. Ante contradicciones, informar el conflicto y solicitar decisión antes de cambiar el alcance.

## 2. Contexto y necesidad del negocio

Las personas que buscan empleo suelen tener dificultades para estructurar su experiencia, seleccionar información relevante, redactar un CV claro y mantener distintas versiones. iArmatuCV busca ofrecer una experiencia accesible, guiada y visualmente amigable para crear, revisar, conservar y gestionar currículums desde el navegador.

**Propuesta de valor:** facilitar el armado de CV mediante un flujo comprensible y responsive, con posibilidad futura de asistencia conversacional con IA. La solución debe permitir completar el proceso básico incluso si todavía no se habilitó la IA.

**Objetivo inicial medible (propuesto):** un usuario autenticado puede crear un CV básico, guardarlo, consultarlo, editarlo y eliminarlo desde PC o celular, sin intervención administrativa. Los umbrales cuantitativos de experiencia y uso se definirán con el equipo.

## 3. Actores y partes interesadas

| Actor | Necesidad / responsabilidad |
|---|---|
| Visitante | Conocer el producto, explorar información pública y acceder a registro/inicio de sesión |
| Usuario registrado | Crear, listar, visualizar, modificar y eliminar **sus propios** CV |
| Equipo del proyecto | Desarrollar, probar, documentar y operar la solución |
| Docente / evaluador | Verificar alcance, ABM, arquitectura y trazabilidad |
| Administrador técnico (interno) | Operar servicios y diagnosticar incidencias sin acceso indiscriminado a datos personales |
| Proveedor de identidad | Amazon Cognito, con posible federación Google |
| Proveedor de IA | Integración futura aún no seleccionada |

**Fuera del MVP:** cuentas de empresa, instituciones educativas, publicación de ofertas y bolsa de trabajo. Son ideas de evolución del producto, no requisitos aprobados de esta primera versión.

## 4. Alcance de la primera entrega (MVP)

### 4.1 Incluido en el MVP

1. Sitio público de presentación de iArmatuCV.
2. Diseño responsive para escritorio y dispositivos móviles.
3. Registro, acceso, cierre de sesión y recuperación de cuenta mediante Cognito, sujetos a configuración de la cuenta AWS.
4. Área privada del usuario autenticado.
5. ABM/CRUD de currículums: alta, listado, consulta individual, modificación y baja.
6. Campos básicos del CV: identificación profesional, resumen, experiencia, educación y habilidades; detalles y obligatoriedad sujetos a validación.
7. Persistencia por usuario, controles de acceso y mensajes de error/confirmación.
8. Selección visual de plantilla **solo si se confirma disponibilidad de plantillas funcionales**; la galería ilustrativa puede existir sin prometer exportación.
9. Aplicación de la identidad visual documentada: paleta, estilos, botones y boceto, sin reproducirlos aquí.

### 4.2 Excluido del MVP / pendiente de decisión

- **IA conversacional:** prevista como evolución; no hay proveedor, costos, cuotas ni comportamiento funcional cerrados.
- **Exportación a PDF:** objetivo de producto, pero su alcance, motor, plantillas exportables y momento de entrega están pendientes.
- Autenticación Google: **deseada**, condicionada a configurar Google como proveedor federado de Cognito; no asumir habilitación automática.
- Ofertas laborales, perfiles de empresas, instituciones, matching y postulaciones.
- Cobros, suscripciones y pasarela de pagos.
- Apps móviles nativas, edición colaborativa y CV públicos indexables.
- Generación de recomendaciones laborales automatizadas o decisiones de selección.

### 4.3 Límites del sistema

El sistema administra la información que el usuario aporta y confirma. No verifica automáticamente títulos, experiencia o identidad laboral; no garantiza contratación ni compatibilidad con todos los ATS. No envía postulaciones ni contacta empleadores en el MVP. El contenido del CV pertenece al usuario y no se publica por defecto.

## 5. Supuestos, dependencias y restricciones

- Frontend acordado: **Angular + TypeScript + HTML + CSS nativo**, sin Bootstrap 5.
- Infraestructura propuesta: **S3 privado + CloudFront, Cognito, API Gateway, AWS Lambda y DynamoDB**, según `IACV-ARC-002`.
- Backend previsto para el circuito ABM: **AWS Lambda con Python**, siguiendo la referencia docente; se documentará su implementación por separado.
- La cuenta AWS educativa puede limitar permisos, servicios o cuotas; comprobar antes de ejecutar despliegues.
- El prototipo visual, la paleta, el catálogo de botones y las imágenes son referencias de diseño, **no evidencia de funcionalidades implementadas**.
- **Cognito no importa cuentas de Gmail automáticamente.** Para permitir «Continuar con Google» se debe configurar federación con Google (OAuth/OIDC), credenciales, redirecciones y consentimiento. Esto autentica una cuenta Google; **no autoriza a leer correos de Gmail**. El acceso a mensajes requeriría permisos y APIs adicionales, fuera de alcance.
- Cualquier integración de IA debe operar desde backend, sin exponer secretos en el navegador.

## 6. Procesos de negocio de alto nivel

### PB-01 — Acceso

Visitante → selecciona registrarse/iniciar sesión → Cognito autentica → aplicación obtiene identidad válida → usuario accede al área privada. Si falla, se muestra un mensaje comprensible sin revelar datos sensibles.

### PB-02 — Creación y mantenimiento de CV

Usuario autenticado → inicia CV → completa campos → revisa → guarda → consulta listado → abre/edita/elimina según necesidad. Toda operación debe verificar propiedad del recurso.

### PB-03 — Exportación (pendiente)

Usuario → selecciona CV → solicita exportación → sistema valida propiedad → genera archivo → permite descarga. **Flujo conceptual no comprometido para el MVP**.

### PB-04 — Asistencia con IA (pendiente)

Usuario → interactúa con asistente → revisa sugerencias → acepta o rechaza → sistema guarda únicamente contenido confirmado. **Flujo conceptual no comprometido para el MVP**.

## 7. Requisitos funcionales

**Estados:** `MVP` = incluido en primera entrega; `Condicional` = depende de decisión/configuración; `Futuro` = fuera de primera entrega. **Prioridad:** Alta/Media/Baja. Cada RF debe validarse con pruebas antes de declararse implementado.

| ID | Requisito verificable | Prioridad | Estado |
|---|---|---|---|
| RF-001 | Mostrar página pública con presentación, navegación y acceso a autenticación | Alta | MVP |
| RF-002 | Permitir registro de usuario a través de Cognito según configuración aprobada | Alta | MVP |
| RF-003 | Permitir inicio de sesión y cierre de sesión seguro | Alta | MVP |
| RF-004 | Permitir recuperación de acceso mediante el flujo habilitado en Cognito | Media | MVP |
| RF-005 | Permitir inicio de sesión con Google federado mediante Cognito | Media | Condicional |
| RF-006 | Restringir el área de gestión de CV a usuarios autenticados | Alta | MVP |
| RF-007 | Crear un CV asociado a la identidad autenticada | Alta | MVP |
| RF-008 | Listar únicamente los CV pertenecientes al usuario autenticado | Alta | MVP |
| RF-009 | Consultar el detalle de un CV propio | Alta | MVP |
| RF-010 | Modificar un CV propio y persistir los cambios | Alta | MVP |
| RF-011 | Eliminar un CV propio con confirmación previa | Alta | MVP |
| RF-012 | Capturar y validar campos básicos del CV y mostrar errores por campo | Alta | MVP |
| RF-013 | Guardar y recuperar el estado de borrador del CV | Alta | MVP |
| RF-014 | Mostrar mensajes de éxito, error y estados de carga para operaciones del usuario | Alta | MVP |
| RF-015 | Impedir consultar, modificar o eliminar CV de otros usuarios | Alta | MVP |
| RF-016 | Mostrar una galería de estilos/plantillas de CV sin afirmar funciones aún no implementadas | Media | MVP |
| RF-017 | Permitir seleccionar y aplicar una plantilla real a un CV | Media | Condicional |
| RF-018 | Generar y descargar un CV en PDF | Alta para producto final | Futuro / por definir |
| RF-019 | Ofrecer asistencia conversacional de IA para completar o mejorar el CV | Alta para visión futura | Futuro / por definir |
| RF-020 | Solicitar aceptación del usuario antes de guardar sugerencias generadas por IA | Alta | Futuro / por definir |

### 7.1 Reglas de negocio

| ID | Regla |
|---|---|
| RN-001 | Cada CV tiene un propietario identificado por el sujeto autenticado; el cliente no puede asignar libremente otro propietario |
| RN-002 | Un usuario solo puede gestionar sus CV, incluso si conoce un identificador ajeno |
| RN-003 | La eliminación requiere confirmación explícita en la interfaz |
| RN-004 | El CV puede guardarse como borrador con los campos mínimos técnicamente necesarios; obligatoriedad final por definir |
| RN-005 | La aplicación no debe mostrar como reales métricas, testimonios, resultados o plantillas que sean ilustrativos |
| RN-006 | La IA no debe modificar datos persistidos sin confirmación del usuario, cuando se implemente |
| RN-007 | El usuario debe conocer qué datos personales se almacenan y disponer de información de privacidad antes de producción |

## 8. Requisitos no funcionales

Los umbrales propuestos deberán validarse en el contexto académico y ajustar según pruebas; no son afirmaciones de rendimiento actual.

| ID | Categoría | Requisito / criterio verificable | Estado |
|---|---|---|---|
| RNF-001 | Responsive | Las vistas principales deben funcionar sin desplazamiento horizontal a anchos de referencia 360, 768 y 1440 px | Propuesto |
| RNF-002 | Accesibilidad | Navegación por teclado, foco visible, etiquetas accesibles, mensajes de error asociados a campos | Propuesto |
| RNF-003 | Accesibilidad | Apuntar a WCAG 2.2 nivel AA para flujos principales; verificar contraste de texto y controles en modo claro/oscuro | Objetivo |
| RNF-004 | Usabilidad | El usuario identifica la acción principal, el estado de guardado y los errores sin depender solo del color | Propuesto |
| RNF-005 | Identidad visual | Reutilizar variables de color, tipografía, espaciado, componentes y estados documentados en el sistema de diseño | Definido como criterio |
| RNF-006 | Movimiento | Hover, transiciones y microinteracciones coherentes; respetar `prefers-reduced-motion` | Propuesto |
| RNF-007 | Seguridad | Todo endpoint privado exige identidad válida y autorización por propiedad de CV | Obligatorio |
| RNF-008 | Seguridad | HTTPS para frontend, autenticación y API; secretos nunca incluidos en archivos públicos | Obligatorio |
| RNF-009 | Privacidad | No registrar tokens, contraseñas ni contenido completo de CV en logs de aplicación | Obligatorio |
| RNF-010 | Datos | Persistencia duradera y estrategia de respaldo/recuperación antes de producción | Pendiente de detalle |
| RNF-011 | Rendimiento | Definir y medir tiempos objetivo de carga y respuesta con entorno y percentil explícitos; no inventar SLA | Pendiente de umbral |
| RNF-012 | Compatibilidad | Probar versiones vigentes de Chrome, Edge y navegadores móviles representativos | Propuesto |
| RNF-013 | Mantenibilidad | Separación entre presentación, reglas de negocio, persistencia e integraciones; documentación versionada | Obligatorio |
| RNF-014 | Observabilidad | Registrar errores y métricas operativas sin datos sensibles; trazabilidad de solicitudes | Propuesto |
| RNF-015 | Costos | Configurar presupuestos/alertas AWS y límites de uso antes de habilitar integraciones de pago | Obligatorio |
| RNF-016 | Resiliencia | Ante falla de la IA futura, el ABM básico de CV debe seguir disponible | Objetivo |
| RNF-017 | Calidad | RF críticos con pruebas positivas, negativas y de autorización antes de aceptación | Obligatorio |
| RNF-018 | Internacionalización | Interfaz inicial en español (Argentina); otros idiomas quedan fuera del MVP | Propuesto |

## 9. Inventario de información del CV (conceptual)

| Grupo | Ejemplos | Observación |
|---|---|---|
| Identificación profesional | Nombre visible, título/puesto objetivo, resumen | Definir campos obligatorios |
| Contacto | Correo, teléfono, ubicación general, enlaces profesionales | Datos personales; evitar exposición pública |
| Experiencia | Cargo, organización, período, tareas/logros | Admite múltiples entradas |
| Educación | Institución, título, fechas | Admite múltiples entradas |
| Habilidades | Tecnologías, competencias, idiomas | Estructura final pendiente |
| Presentación | Plantilla elegida, estado borrador | Plantillas funcionales sujetas a decisión |
| Metadatos | Identificador de CV, propietario, creación, modificación | Generados/controlados por backend |

No se define aquí el esquema definitivo de DynamoDB, claves secundarias, validadores ni formatos de API.

## 10. Matriz de trazabilidad inicial

| Necesidad de negocio | Requisitos | Validación principal |
|---|---|---|
| Acceso seguro | RF-002 a RF-006, RNF-007 a RNF-009 | Registro/login, acceso denegado y cierre de sesión |
| Crear CV | RF-007, RF-012, RF-013 | Alta válida e inválida, persistencia de borrador |
| Gestionar CV | RF-008 a RF-011, RF-015 | Listar/obtener/editar/eliminar propio y denegar ajeno |
| Experiencia visual | RF-001, RF-014, RF-016, RNF-001 a RNF-006 | Pruebas responsive, teclado, contraste, estados y hover |
| Evolución PDF | RF-018 | Prueba por definir cuando se apruebe alcance |
| Evolución IA | RF-019, RF-020, RNF-016 | Prueba por definir cuando se apruebe proveedor y flujo |

## 11. Criterios de aceptación del MVP (escenarios)

**CA-01 — Acceso protegido.** Dado un visitante no autenticado, cuando intenta acceder al panel de CV, entonces debe ser dirigido al flujo de autenticación y no recibir datos privados.

**CA-02 — Alta.** Dado un usuario autenticado y datos válidos, cuando guarda un CV, entonces se crea un registro asociado a su identidad y se muestra confirmación.

**CA-03 — Listado.** Dado un usuario con varios CV, cuando abre su listado, entonces ve exclusivamente los propios.

**CA-04 — Modificación.** Dado un CV propio, cuando modifica un campo válido y guarda, entonces el cambio persiste al volver a abrirlo.

**CA-05 — Baja.** Dado un CV propio, cuando confirma su eliminación, entonces deja de estar disponible en su listado; si cancela, permanece.

**CA-06 — Autorización.** Dado un usuario A, cuando intenta acceder al identificador de un CV de B, entonces la operación es denegada sin revelar datos de B.

**CA-07 — Responsive.** Dada una pantalla móvil de 360 px, cuando navega por la portada y el flujo básico de CV, entonces puede leer y operar sin desbordamiento horizontal.

**CA-08 — Modo oscuro.** Dado el tema oscuro, cuando recorre pantallas principales, entonces el texto, controles y estados de foco conservan contraste y legibilidad verificables.

**CA-09 — Google federado (condicional).** Dado Cognito correctamente federado con Google, cuando selecciona «Continuar con Google», entonces completa la autenticación sin que la aplicación solicite permiso de lectura de Gmail.

## 12. Experiencia visual y documentación relacionada

Existe una línea visual para iArmatuCV: logo/mascotas, paleta de colores, estilos CSS propios, boceto de landing, modo claro/oscuro y laboratorio de botoneras animadas. **Estos recursos se mantienen como documentos/artefactos independientes** y deben ser consultados antes de implementar UI. Este archivo solo fija las exigencias funcionales y de calidad:

- CSS nativo, sin Bootstrap 5.
- Paleta de violetas, cian, rosa y neutros; **usar los tokens definitivos del documento de diseño, no colores duplicados en cada vista**.
- Iconografía SVG consistente, microinteracciones útiles, hover/focus/active y movimiento reducido cuando corresponda.
- Responsive y legibilidad real en modo oscuro.
- No usar cifras ilustrativas (por ejemplo, usuarios o porcentajes de satisfacción) como métricas verificadas.

**Referencias disponibles en la carpeta de trabajo previa:** `DISENO.md`, `styles.css`, bocetos HTML/CSS y `BOTONERA.md`. Sus rutas definitivas dentro del repositorio `docs/07-diseno/` deben confirmarse; no asumir que ya están copiadas allí.

## 13. Fronteras entre análisis funcional y disciplinas técnicas

| Documento | Responde |
|---|---|
| Este documento, `IACV-AF-001` | ¿Qué problema resolvemos? ¿Para quién? ¿Qué hace y qué no hace el producto? ¿Cómo se acepta? |
| `IACV-ARC-002` | ¿Qué servicios AWS componen la arquitectura y cómo se conectan? |
| Documento frontend futuro | ¿Cómo se implementan vistas, componentes, formularios y estados en Angular? |
| Documento backend futuro | ¿Cómo se implementan Lambda, validaciones y contratos HTTP? |
| Documento de datos futuro | ¿Cómo se estructura DynamoDB y se gestionan datos? |
| Documento de diseño | ¿Qué tokens, estilos, íconos y animaciones usa la interfaz? |
| Plan de pruebas futuro | ¿Qué casos, evidencias y resultados demuestran conformidad? |

## 14. Riesgos funcionales

| Riesgo | Impacto | Tratamiento |
|---|---|---|
| Interpretar «login con Gmail» como lectura de correos | Alto | Aclarar federación Google vs. Gmail API |
| Crecimiento de alcance hacia bolsa de empleo | Alto | Mantener backlog futuro separado del MVP |
| Implementar IA/PDF antes de definición | Medio/alto | Bloquear decisiones de proveedor y motor hasta aprobación |
| Acceso entre usuarios a CV ajenos | Alto | Pruebas obligatorias de propiedad y autorización |
| Modo oscuro ilegible o animaciones excesivas | Medio | Revisiones WCAG, contraste y reducción de movimiento |
| Dependencia de permisos AWS educativos | Medio | Validar servicios disponibles antes de comprometer fechas |

## 15. Preguntas abiertas y decisiones por aprobar

| ID | Pregunta | Responsable sugerido | Estado |
|---|---|---|---|
| D-001 | ¿El MVP permite registro por correo/contraseña, Google federado o ambos? | Equipo/docente | Abierta |
| D-002 | ¿Cuáles campos de CV son obligatorios y cuáles opcionales? | Análisis funcional | Abierta |
| D-003 | ¿Cuántas plantillas funcionales se entregan en el MVP? | Equipo | Abierta |
| D-004 | ¿La eliminación es lógica, física o con período de recuperación? | Equipo/seguridad | Abierta |
| D-005 | ¿Se implementa PDF en esta entrega o en una fase posterior? | Equipo/docente | Abierta |
| D-006 | ¿Qué proveedor de IA, si alguno, se usará y qué límites tendrá? | Equipo/docente | Abierta |
| D-007 | ¿Cuáles son los objetivos medibles de rendimiento, disponibilidad y recuperación? | Equipo | Abierta |
| D-008 | ¿Qué política de privacidad, retención y eliminación de cuenta aplicará? | Equipo | Abierta |
| D-009 | ¿La futura bolsa de trabajo institucional tendrá documento de producto independiente? | Equipo/docente | Abierta |

## 16. Instrucciones operativas para Codex

1. Leer este documento antes de proponer funcionalidades o cambios de alcance.
2. Leer `IACV-ARC-002` para respetar la arquitectura cloud vigente.
3. Consultar documentos de frontend, backend y diseño para **cómo** implementar; este archivo define **qué** y **para qué**.
4. No convertir decisiones abiertas en implementaciones por inferencia.
5. Mantener identificadores `RF-`, `RNF-`, `RN-` y `CA-` en issues, commits y pruebas cuando sea posible.
6. Ante un cambio de alcance, proponer nueva versión del documento y actualizar trazabilidad.
7. No publicar ni desplegar recursos AWS, habilitar APIs pagas o modificar permisos sin aprobación explícita.

## 17. Historial de versiones

| Versión | Fecha | Descripción |
|---|---|---|
| 1.0 | 2026-10-23 | Primera especificación funcional: contexto, MVP, límites, RF/RNF, escenarios, referencias y decisiones abiertas |

---

**Estado del documento:** propuesta funcional para revisión. La aprobación del equipo y docente fijará la línea base del MVP.
