# IACV-ADR-001 — Cimientos y decisiones técnicas actuales

Fecha: 2026-10-23. Estado: aplicado a la fase 1 local; despliegue no autorizado.

## Fuentes y precedencia

Se revisaron `Arquitectura AWS/README.md`, `01-arquitectura/IACV-ARC-002_Arquitectura_Tecnica_AWS.md`, el análisis funcional IACV-AF-001, los bocetos estáticos y la botonera v3. También se consultaron los programas y ejemplos locales de Front End, Back End y Nube como documentación de la cursada.

La actualización técnica adjuntada por el usuario y su instrucción de construir los cimientos autorizan crear las aplicaciones en las carpetas existentes `Back End` y `Front End`. Estas estaban vacías antes de implementar. No se mueve, elimina ni sobrescribe documentación histórica. Esta organización prevalece sobre el ejemplo genérico `frontend/backend` del adjunto.

## Comparación con el estado inicial

| Elemento | Existente | Decisión actual |
|---|---|---|
| UI | Bocetos HTML/CSS/JS nativos | Conservar identidad; convertir estructura a componentes Angular |
| Frontend | Angular mencionado, sin aplicación en esta carpeta | Crear Angular + TypeScript |
| Backend | Lambda propuesta en documentos, sin backend ejecutable | Node.js + Express + TypeScript como único backend principal |
| Datos | DynamoDB propuesta | PostgreSQL definido; conexión y modelo pendientes |
| Identidad | Cognito propuesto | Se conserva; no crear login local ni sesión simulada |
| Hosting | S3/CloudFront propuestos | Amplify frontend y App Runner backend propuestos por actualización; no implementados |
| Recursos visuales | Marca, gradientes, modo oscuro, botones, ilustraciones | Reutilizar criterios y CSS; conservar archivos originales |
| IA/PDF | Visión y bocetos | Fuera de implementación hasta definición |

La sustitución Lambda/DynamoDB es explícita en la actualización del usuario. Los criterios históricos que exigen esos servicios no se consideran criterios de esta fase. No se crean dos backends. Hay referencias internas con numeración de unidades/año anterior; los documentos no confirman permisos actuales de AWS.

## Stack y utilidades

Angular 22 con TypeScript 6.0 en frontend; Express 5 con TypeScript 7 en backend; Node 24.22.1 en ambos. La actualización del 2026-10-24 fue autorizada por el usuario y mantiene versiones estables compatibles entre sí. Angular se migró por etapas 20 → 21 → 22. PostgreSQL es una decisión de arquitectura, todavía sin driver ni servidor configurado. CORS/dotenv y tsx son utilidades para HTTP, configuración y ejecución TypeScript; no se agregan ORM, framework CSS, librería de autenticación, contenedores o plataforma de pruebas externa.

Referencias oficiales de compatibilidad consultadas:

- https://angular.dev/reference/versions
- https://expressjs.com/en/starter/installing/

## Plan de adaptación por etapas

| Fase | Front End | Back End / datos | Infraestructura |
|---|---|---|---|
| 1 — Base e integración | SPA, identidad visual, navegación y catálogo desde API | Express por capas, health, catálogo público y errores | Ningún recurso cloud |
| 2 — Contratos y datos | Diseñar formulario y listado según contrato | Definir campos mínimos, modelo SQL, Repository, validaciones y CRUD; comprobar con PostgreSQL de prueba | Decidir PostgreSQL de desarrollo, sin costos implícitos |
| 3 — Identidad e integración privada | Cognito, flujo de acceso y editor conectado | Validar identidad y propiedad, habilitar endpoints solo después de pruebas entre usuarios | Configurar Cognito únicamente con autorización |
| 4 — Entrega cloud | Build y rutas SPA | Build productivo y conexión persistente | Validar servicios/permisos/costos; proponer despliegue concreto para aprobación |
| Posterior | Evoluciones aprobadas | IA/PDF solo tras definición | Según decisiones futuras |

Las fases 2 y 3 deben converger antes de habilitar datos privados. No se publica un CRUD sin identidad válida; para probar la capa de datos se usarán pruebas aisladas, sin aceptar un propietario inventado desde el navegador.

## Trazabilidad académica

- Front End: fundamentos HTML/CSS y TypeScript, componentes, propiedades/binding, servicios, Router, control de flujo y HttpClient.
- Back End: Node/npm, módulos, funciones/objetos/JSON, HTTP, Express, routers, middleware, separación Controller/Service; Repository y SQL al incorporar datos.
- Nube: arquitectura documentada y decisiones AWS pendientes. El ejemplo React/Lambda del material no reemplaza el stack aprobado de Angular/Express.
- Ingeniería de Software: decisiones, alcance por fases, contrato HTTP y criterios de validación quedan disponibles para la documentación posterior.

## Límites de aceptación de esta fase

La fase 1 demuestra estructura, ejecución independiente y una petición Angular → Express real. No constituye el MVP completo: RF de identidad, CRUD, propiedad y borradores siguen pendientes. La portada cubre parte de RF-001 y RF-016; faltan el acceso real y pruebas completas de experiencia/accesibilidad. No declarar conformidad total con los RNF por contar con CSS responsive.

## Decisiones abiertas

- Campos obligatorios y estructura final de experiencia, educación y habilidades.
- Motor PostgreSQL de desarrollo, migraciones, backups y modelo por propietario.
- Configuración Cognito y Google federado.
- Disponibilidad de Amplify, App Runner y RDS en la cuenta académica; alternativas si el profesor restringe servicios.
- Requisito docente específico de Lambda/API Gateway, si lo hubiera.
- Hosting final, costos, región y automatización de despliegue.
