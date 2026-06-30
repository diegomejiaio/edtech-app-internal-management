# 10 — WhatsApp CRM (MVP) — Spec & API Contract

> MVP del inbox CRM de WhatsApp para Espacio Pro. Stack actual: Next.js 16 export +
> Functions .NET 10 + Cosmos NoSQL. Probado localmente a nivel UI (sin número real):
> webhook/envío Meta/IA = stubs. Reusa patrones de wacrm portados a .NET/Cosmos.

## 1. Cosmos: container `whatsapp` (PK `/type`)
Tipos (camelCase): `conversation`, `message`, `lead`, `waConfig`. Audit + soft-delete estándar.

### conversation
```jsonc
{ "id":"<guid>", "type":"conversation", "waContactId":"51999...", "displayName":"Ana",
  "phone":"+51999...", "status":"open|pending|closed", "assignedTo":null,
  "aiMode":"off|assist|autopilot", "leadState":"new|interested|visit|enrolled|paid|noreply|support",
  "lastInboundAt":"<iso>", "lastMessageAt":"<iso>", "lastMessagePreview":"...", "unread":2 }
```
### message
```jsonc
{ "id":"<guid>", "type":"message", "conversationId":"<guid>", "waMessageId":"wamid..",
  "sender":"customer|agent|bot", "kind":"text", "text":"horarios?",
  "status":"sending|sent|delivered|read|failed", "ts":"<iso>",
  "aiSuggested":false, "confidence":null }
```
### lead / waConfig: lead{phone,state}; waConfig{phoneNumberId,wabaId,verifyToken} (tokens NO en repo).

## 2. API (`/api/v1/...`, RequireRole admin, RFC7807 errors, camelCase)
| Method | Route | Purpose |
|---|---|---|
| GET | `/wa/conversations?status=&search=&limit=&offset=` | paginated conversations |
| GET | `/wa/conversations/{id}` | one conversation |
| PATCH | `/wa/conversations/{id}` | update status/assignedTo/aiMode/leadState |
| GET | `/wa/conversations/{id}/messages?limit=&offset=` | thread page, **newest-first** (`ts DESC`); load latest N and page backwards (never loads full history) |
| POST | `/wa/conversations/{id}/messages` | agent manual reply `{text, attachments?}` (stub send; media → Azure Blob en Fase 1) |
| POST | `/wa/conversations/{id}/ai-suggest` | stub: returns suggested text + confidence |
| POST | `/wa/messages/improve` | compose assistant stub: rewrite/proofread/adjust draft `{text,action,instruction?}` → `{text}` |
| GET/POST | `/wa/webhook` | Meta verify (GET) + events (POST) stub, HMAC-ready |

Paginated shape = existing `Paginated<T>` (items,total,limit,offset). Sends mark conversation
read, set lastMessage*, store agent message status=sent.

## 3. Frontend `/inbox`
3 panes: conversation list (búsqueda + chips de estado + "No leídas" + popover de **Filtros** multi-criterio: estado del lead, modo IA, etiquetas; chips de filtros activos + contador) | message thread + composer |
lead panel (lead state, aiMode toggle off/assist/autopilot, AI-suggest button, quick replies
horarios/precios/ubicación/link). Spanish UI. Mock fallback if API unreachable.

## 4. Out of scope: real Meta send, broadcasts, flows, autopilot real, deploy.

## 5. Servicios críticos → Azure Container Apps (post-MVP)
Inspiración fuerte de [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) (MIT): inbox compartido,
estados, plantillas, webhook firmado HMAC, cifrado de token — portado a .NET/Cosmos.
Cuando exista número real, lo crítico va en **ACA min=1** (sin cold start): `wa-webhook`
(ACK <1s + HMAC + encola) y `ai-orchestrator` (MAF). CRUD inbox = Functions. Cola = Storage Queue.
Tiempo real al inbox = Azure SignalR. Ver `infra/modules/aca-whatsapp.bicep` (skeleton) y research
en sesión previa. MVP local: stubs + mock, sin ACA.

## 6. Decisiones & Aprendizajes (MVP, 2026-06-29)

> Lecciones concretas de la sesión de construcción del MVP. Mantener al día cuando
> evolucione el módulo. Refleja también en Engram (`mem_save`, topic `architecture/espacio-pro-v1`).

### Decisiones
- **No forkear wacrm.** Es Supabase/Postgres/BullMQ; incompatible con Cosmos/Functions.
  Se **portan patrones** (inbox, estados, webhook HMAC, plantillas, cifrado token) a .NET/Cosmos.
- **Container único `whatsapp`** (PK `/type`) en vez de 1 container por tipo: mantiene el patrón
  de 2 containers del repo y permite consultas por `type` con índices compuestos
  (`type,status,lastMessageAt` para el inbox; `type,conversationId,ts` para el thread).
- **Servicios críticos en ACA `minReplicas=1`** (webhook ACK <1s, orquestador IA/MAF) para evitar
  cold start de Functions Consumption → Meta reintenta y duplica. CRUD administrativo sigue en Functions.
- **IA como copiloto, no autopilot**: `aiMode` off/assist/autopilot por conversación; autopilot solo
  intents seguros (horarios/precios/ubicación/link). Webhook/IA/envío Meta = **stubs** en v1.
- **Tokens fuera del repositorio**: `WaConfig.verifyToken` es `[JsonIgnore]`; secretos Meta van a
  app settings (KV ligero futuro), nunca persistidos en Cosmos.

### Aprendizajes técnicos
- **Contrato de campos debe fijarse en la spec.** El stub `ai-suggest` divergió: backend devolvía
  `suggestion`, frontend leía `text` → el composer quedaba vacío contra el backend real (lo enmascaró
  el mock). Regla: la spec (§2) fija nombres de campos exactos, no solo "texto + confianza".
- **El cliente API del frontend no expone PATCH** (solo GET/POST/PUT/DELETE). Los endpoints de
  actualización deben aceptar **PUT** (aquí PUT y PATCH) o el front no puede llamarlos.
- **Mock fallback (`NEXT_PUBLIC_WA_MOCK`) permite probar UI sin número ni backend**, pero puede
  ocultar mismatches de contrato → siempre verificar también contra el backend real antes de cerrar.
  El fallback dispara solo en error de red; los `ApiError` HTTP se propagan (fallos reales visibles).
- **El container nuevo no existe en `espaciopro-dev`**: se añadió `WhatsAppContainerBootstrap`
  (`CreateContainerIfNotExistsAsync(/type)`) para que el dev local funcione sin desplegar Bicep.
- **`whatsapp` sin unique key en `/dedupKey`**: re-correr `seed --whatsapp` **duplica**; `--reset`
  solo limpia master/operations. Pendiente: soporte de reset para `whatsapp`.

### Proceso
- **Multi-agente en paralelo** (backend + frontend) sobre una spec/contrato previa (`docs/10`) evita
  acoplamiento; la crítica con `code-review` atrapó el mismatch de contrato antes de cerrar.
- **Reglas de aprobación**: todo quedó local y reversible (sin commit, push ni deploy).

## 7. Sección CRM — arquitectura de información

> "Mensajes" evolucionó a una **sección CRM** completa. En el sidebar hay un grupo **CRM**
> (junto a "Principal"/"Finanzas") con estas sub-secciones, ruta `/crm/*`:

| Sub-sección | Ruta | Qué hace | Reusa wacrm | Fase |
|---|---|---|---|---|
| Mensajes (Inbox) | `/crm/inbox` | Bandeja compartida (construido) | inbox/conversations | ✅ MVP |
| Explorer (Kanban\|Sheet) | `/crm/explorer` | Pipeline de leads: Kanban por estado + tabla | pipelines/deals | F2 |
| Flujos | `/crm/flows` | Automatizaciones trigger→acción→wait→condición (motor del autopilot) | automations/engine | F4 |
| Reutilizables | `/crm/library` | Biblioteca: textos, imágenes, voz, video, links, mensajes ricos, plantillas Meta | templates + media | F1/F4 |
| Métricas | `/crm/metrics` | TTFR, %IA, %derivado, conversión, costo (vía change feed) | dashboard | F2 |
| Agentes | `/crm/agents` | Config de agentes IA (MAF): instructions, tools, intents autopilot, umbral confianza | — (nuevo) | F3/F4 |
| Ajustes | `/crm/settings` | wa_config, horario, opt-in/out, ventana 24h, equipo/asignación | config | F1 |

### Implementación actual (scaffold)
- `frontend/src/app/(app)/crm/layout.tsx`: contenedor full-height edge-to-edge (`-m-6`). Nav en sidebar (grupo "CRM").
- **Sin header superior**: se eliminó la barra `h-14`; toggle del sidebar, tema y perfil viven en el footer del sidebar (+ trigger flotante en móvil). El contenido usa todo el alto del viewport.
- `crm/inbox` funcional (mock); **`crm/explorer` funcional (mock)**: pipeline Kanban (columnas por `leadState`, **drag&drop** para cambiar estado vía PATCH) + vista **Tabla**; **filtros** (búsqueda + programa drywall/melamina); tarjetas muestran **programa** y, en etapa Visita, **fecha/hora de la visita**; click abre la conversación (`?c=`).
- **Resto de pantallas CRM (mock, funcionalidad front end-to-end):** **Flujos** (CRUD de flujos + pasos: crear/renombrar/eliminar/activar, agregar/editar/eliminar pasos), **Reutilizables** (CRUD de assets con previews compactos solo-icono; crear/editar/eliminar), **Métricas** (KPIs + embudo con **selector de periodo** 7/30/90d y **drill-down tipo Metabase**: clic en etapa/programa → lista de registros que abren la conversación), **Agentes** (**multi-agente**: lista con crear/eliminar/agente por defecto + config por agente: instrucciones, tools, intents seguros, umbral), **Ajustes** (conexión Cloud API, horario, cumplimiento Meta, equipo).
- **Agente por conversación**: el inbox permite **asignar un agente** (por defecto + override) vía `assignedTo`; catálogo compartido en `lib/crm/agents.ts`.
- **Visita presencial**: editor de **fecha y hora** en el inbox cuando el lead está en etapa Visita (`visitAt`), mostrada en Explorer (tarjeta + columna Tabla). Backend `WaConversation` tiene `program`/`visitAt`; PATCH los acepta (string vacío limpia).
- **Deep-link por conversación**: `/crm/inbox?c=<conversationId>` (query param, no ruta dinámica — el static export no las permite; `useSearchParams` envuelto en `Suspense`).
- **Móvil**: la lista ocupa toda la pantalla; al tocar un chat se entra a la vista del hilo (full-screen) con botón "volver". En `md+` se muestran lista + hilo (+ panel derecho en `lg`).
- **Paginación del hilo**: el chat **no carga toda la historia**. Trae las **últimas 25** (`GET …/messages?limit=25&offset=0`, `ts DESC`) y un botón **"Cargar mensajes anteriores"** pagina hacia atrás (`useInfiniteMessages` + `getNextOffset`); el front aplana y ordena ASC para mostrar. Backend limit default 25, **máx 100**.
- **Composer**: además del envío manual, **adjuntar imágenes y documentos** (botón "+" → Imágenes/Documento) con preview y opción de quitar antes de enviar; mensajes con imágenes se renderizan inline y los documentos como enlace. En MVP/mock los adjuntos usan object URLs locales; la subida real va a **Azure Blob** (Fase 1). Y un **asistente de redacción** (ícono varita) que transforma el borrador: Reescribir, Corregir, Ajustar tono (Conciso/Más largo/Casual/Profesional/Seguro/Entusiasta) y Personalizado. Endpoint `POST /wa/messages/improve` (stub heurístico; real = MAF Fase 3).
- **Desktop**: al entrar sin `?c=`, abre la conversación **más reciente** por defecto (deep link). En móvil no auto-abre.
- **Header del hilo**: incluye el selector de **estado del lead** (donde antes iba el badge de estado).
- **Panel derecho** (`lg`): arriba **Datos del alumno** (lectura por defecto + botón "Editar"; campos alineados al `Student` real: Nombre/Apellido, Tipo+N° documento, Teléfono, Email, Fuente, Notas) más **Etiquetas** e **Interesado en**; luego **Respuestas rápidas** (scroll). Persistencia = stub. Abajo, **sticky**, el widget de **IA**: modo en **control segmentado** (Desactivada/Asistida/Automática, selección única) con descripción. **Asistida** → instrucción puntual opcional (vacío = la IA responde con el contexto) + "Sugerir con IA". **Automática** → **objetivo** del autopilot en **lectura** (muestra el default) con botón "Editar"; la edición es **por contacto/lead** (override del default, badge Predeterminado/Personalizado, opción de restablecer). Responde sola y deriva si no está segura.
- `/crm` y el viejo `/inbox` redirigen a `/crm/inbox`. Seguimiento: issue #14.

### Nuevos `type` Cosmos (container `whatsapp`) a futuro
`pipeline`/`stage`/`deal` (Explorer), `flow` (Flujos), `asset` (Reutilizables; media en **Azure Blob**),
`template` (subset de asset con `category` Meta + estado), `agentConfig` (Agentes), `metricSnapshot` (opcional).
Todos con audit + soft-delete + PK `/type`.

### Decisiones de diseño
- **Explorer no es entidad nueva al inicio**: Kanban usa `leadState` como columnas y proyecta `lead`/`conversation`;
  formalizar `pipeline/deal` solo si se venden oportunidades con monto.
- **Flujos = UI del motor de automatización** que decide cuándo la IA responde sola (autopilot F4); primero
  el modelo trigger→condición→acción, el builder visual después.
- **Reutilizables habilita** quick-replies del inbox (hoy hardcodeadas → pasan a `asset`), contenido de Flujos
  y plantillas Meta para fuera de ventana 24h. Media requiere Azure Blob (nuevo en infra).
