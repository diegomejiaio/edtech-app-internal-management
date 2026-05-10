📋 Context
Espacio Pro actualmente opera 100% en Google Sheets + Apps Script. El objetivo es migrar a una aplicación web real que reutilice la estructura de MerkiCont (Next.js) como base del frontend, con un backend en .NET 10 Azure Functions y Cosmos DB serverless, manteniendo exactamente las mismas entidades y flujos de negocio del Sheet actual.

Repo de GAS App: https://github.com/diegomejiaio/espacio-pro-lite

🎯 Goal
Construir Espacio Pro como una web app full-stack que reemplace el Google Sheet, con la misma cobertura funcional, costos mínimos en Azure, y que sirva como proyecto de aprendizaje real de .NET 10 + Azure Functions.

📐 Spec
User Story
As an admin of Espacio Pro, I want a web app to manage alumnos, horarios, inscripciones, pagos y profesores, so that I no longer depend on Google Sheets and have a proper UI with real data integrity.

Acceptance Criteria
M1 — Alumnos


Listar con búsqueda por nombre/DNI

CRUD completo (Nombre, DNI único, Celular, Correo, Fuente)

Ver historial de inscripciones y pagos del alumno
M2 — Profesores


CRUD completo (Nombre, DNI, Celular, Correo, Especialidad)

Ver historial de pagos del profesor
M3 — Horarios


CRUD completo (Curso, Nivel, Profesor, Días, Hora inicio/fin, Precio, Capacidad, Fecha inicio, Estado)

Mostrar inscritos activos vs capacidad

Activar/desactivar horario
M4 — Inscripciones


Inscribir alumno a horario (validar no duplicado activo en mismo horario)

Listar por horario y por alumno

Cambiar estado (Activo / Baja / Congelado)
M5 — Pagos alumnos


Registrar pago (FK inscripción, fecha, monto, cuota N°, medio de pago)

Listar por inscripción y por mes

GET /api/pagos/deudores?mes=YYYY-MM — inscritos activos sin pago en el período
M6 — Pagos Profesores


Registrar honorario (FK profesor, fecha, monto, concepto)

Listar por profesor y período
M7 — Gastos


Registrar gasto (fecha, categoría, descripción, monto, medio de pago, horario opcional)

Listar por período y categoría
M8 — Dashboard


Alumnos activos totales

Ingresos / egresos / utilidad del mes

Horarios activos con % de ocupación

Lista de deudores del mes
Out of Scope (v1)
Multi-tenant
Notificaciones / email / WhatsApp
Portal del alumno (solo admin)
Reportes PDF / Excel
Staging environment (solo dev y prod)
🏗️ Technical Notes
Frontend — espacio-pro/front/
Clonar ~/Documents/merkicont/front/ como base (Next.js 15, TypeScript, Tailwind, shadcn/ui, App Router)
Auth: Clerk free tier — JWT enviado en cada request a Functions
Eliminar todo lo específico de MerkiCont (BFF, Cosmos calls, etc.) y adaptar al dominio Espacio Pro
Reutilizar: layout, sidebar, shadcn components, estructura de hooks, tipos
Backend — espacio-pro/back/
Azure Function App, .NET 10 isolated worker
Una Function HTTP por dominio:
AlumnosFunction — GET list, GET by id, POST, PUT, DELETE
ProfesoresFunction
HorariosFunction
InscripcionesFunction
PagosFunction — incluye GET /deudores
PagosProfesoresFunction
GastosFunction
DashboardFunction
JWT Clerk validado en cada función via ClerkJwtValidator.cs (helper compartido, usa JWKS endpoint de Clerk + System.IdentityModel.Tokens.Jwt)
Cosmos SDK: Microsoft.Azure.Cosmos
Un container Cosmos por entidad, partition key /id
Cosmos DB
Containers: alumnos, profesores, horarios, inscripciones, pagos, pagos_profesores, gastos, catalogo
Mode: serverless (paga por RU consumidas, no por hora)
IDs: GUID generado en backend (reemplaza correlativos del Sheet)
Infra — espacio-pro/infra/ (Bicep MVP)
Clonado y simplificado de MerkiCont. Sin ACR, sin Container Apps, sin Log Analytics.

Resource groups:

rg-espaciopro-shared  →  Cosmos DB (serverless) + Key Vault
rg-espaciopro-{env}   →  Function App (consumption) + Storage Account + SWA (Free)
Módulos Bicep:

main.bicep — scope subscription, orquesta los 2 RGs
modules/shared.bicep — Cosmos DB account + database + containers + Key Vault
modules/environment.bicep — Storage Account + App Service Plan (Y1 consumption) + Function App + Static Web App (Free SKU)
Parámetros (main.dev.bicepparam):

param projectName = 'espaciopro'
param environment = 'dev'
param location = 'eastus2'
Scripts:

deploy.sh [dev|prod] — az deployment sub create
deploy-front.sh — build Next.js + upload a SWA via deployment token
get-env.sh — descarga vars de Azure a .env.local
Function App env vars:

COSMOS_CONNECTION_STRING  → Key Vault reference
CLERK_JWKS_URL            → https://your-clerk-domain/.well-known/jwks.json
🔗 Dependencies
Cuenta Azure activa (Cosmos serverless disponible)
Clerk account (free tier)
Base front: ~/Documents/merkicont/front/
Base infra: ~/Documents/merkicont/infra/
📎 References
Repo actual (Apps Script): https://github.com/diegomejiaio/espacio-pro-lite
MerkiCont (referencia arquitectónica): MerkiCont/MerkiCont-Automatizacion-Contable
⏱️ Estimated Complexity
XL — proyecto nuevo completo. Fases sugeridas:

F1: Infra Bicep + scaffold repos (front + back)
F2: M1–M4 CRUD base
F3: M5–M8 lógica de negocio + dashboard