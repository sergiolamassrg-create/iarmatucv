# iArmatuCV — Proyecto Final

Aplicación en desarrollo con frontend Angular y API Express separados.

Versiones de desarrollo: Angular 22 con TypeScript 6.0 en frontend; Express 5 con TypeScript 7 en backend. Ambos usan Node 24.22.1. Las versiones exactas se conservan en el `package-lock.json` de cada proyecto.

## Organización obligatoria

```text
Proyecto Final/
  Front End/        Angular + TypeScript + HTML/CSS nativo
  Back End/         Node.js + Express + TypeScript
  docs/             Decisiones actuales y etapas
  Arquitectura AWS/ Documentación y prototipos históricos, conservados
```

Cada aplicación tiene su propio `package.json`, dependencias y comandos para poder presentarse por separado en su materia. Los scripts de esta raíz son atajos opcionales; no hay dependencias entre carpetas de código. Las otras materias fuera de `Proyecto Final` se usan únicamente como documentación.

## Ejecutar

Requisitos: Node.js 24 desde la versión 24.22.1, npm y navegador. Frontend y backend se verificaron con Node 24.22.1. No requiere cuenta AWS, PostgreSQL ni credenciales para las funciones actuales.

Desde `Proyecto Final`:

```powershell
npm.cmd run install:all
```

En una terminal:

```powershell
npm.cmd run backend:dev
```

En otra terminal:

```powershell
npm.cmd run frontend:dev
```

- Portada: http://127.0.0.1:4200/
- Estado de conexión real Angular → API: http://127.0.0.1:4200/estado
- Estado de API: http://127.0.0.1:3000/api/v1/health
- Catálogo de plantillas: http://127.0.0.1:3000/api/v1/plantillas

Los servidores se inician solamente en la interfaz local. Si los puertos están ocupados, detener el proceso propio que los ocupa o cambiar la configuración de ambos proyectos.

## Construir y verificar

```powershell
npm.cmd run build
```

También pueden ejecutarse directamente `npm.cmd install`, `npm.cmd run build` y sus comandos de desarrollo dentro de cada carpeta. Ver los README de cada materia.

## Estado real

Implementado: portada Angular basada en el boceto original con ilustración, fuentes locales, animaciones CSS, seis diseños seleccionables y vista previa ampliada. Angular obtiene el catálogo desde Express mediante HttpClient, con estados de carga, error y reintento. La API organiza el catálogo en Router, Controller, Service y Repository. Incluye navegación, temas claro/oscuro y consulta de estado de la API.

Se integraron los formularios de acceso con Cognito a través del backend Express existente: registro, confirmación, ingreso, recuperación, nueva contraseña y sesión con cookie HttpOnly. Completar el Client Secret del app client en `Back End/.env` si corresponde y revisar [la configuración de Cognito](docs/Cognito.md). La prueba con una cuenta real requiere esa configuración; no se crearon cuentas de prueba en AWS.

Pendiente: CRUD de CV, persistencia, autorización por propietario y despliegue. No se guardan CV ni se simulan cuentas. Las rutas de CV se incorporarán al implementar sus operaciones. Un healthcheck correcto **solo indica que la API responde**.

No se implementan IA, generación PDF ni Google federado. No se crearon ni desplegaron recursos AWS durante estos cambios.

## Documentación vigente

- [Decisiones y plan por etapas](docs/IACV-ADR-001_Cimientos_y_decisiones.md).
- [Frontend](Front%20End/README.md).
- [Backend](Back%20End/README.md).

La separación acordada entre entregas contempla Express/TypeScript con MongoDB para Backend y Python/Lambda con DynamoDB para Nube. Esta copia todavía ejecuta Express; integrar Cognito no la convierte en un backend Lambda. La adaptación de ejecución y sesiones para AWS queda pendiente. Los originales de `Arquitectura AWS` se mantienen intactos.
