import type { BaseEntity, ListParams, PaginatedResponse } from './types';
import type { ApiClient } from './client';
import { isApiError } from './errors';

// ---------------------------------------------------------------------------
// Enums (wire format) + Spanish UI labels
// ---------------------------------------------------------------------------

/** Conversation lifecycle status (wire format). */
export type WaStatus = 'open' | 'pending' | 'closed';

/** AI automation mode per conversation (wire format). */
export type WaAiMode = 'off' | 'assist' | 'autopilot';

/** CRM lead funnel state (wire format). */
export type WaLeadState =
  | 'new'
  | 'interested'
  | 'visit'
  | 'enrolled'
  | 'paid'
  | 'noreply'
  | 'support';

/** Message author (wire format). */
export type WaSender = 'customer' | 'agent' | 'bot';

/** Outbound message delivery state (wire format). */
export type WaMessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/** Spanish UI labels for {@link WaStatus}. */
export const WA_STATUS_LABELS: Record<WaStatus, string> = {
  open: 'Abierta',
  pending: 'Pendiente',
  closed: 'Cerrada',
};

/** Spanish UI labels for {@link WaAiMode}. */
export const WA_AI_MODE_LABELS: Record<WaAiMode, string> = {
  off: 'Desactivada',
  assist: 'Asistida',
  autopilot: 'Automática',
};

/** Spanish UI labels for {@link WaLeadState}. */
export const WA_LEAD_STATE_LABELS: Record<WaLeadState, string> = {
  new: 'Nuevo',
  interested: 'Interesado',
  visit: 'Visita presencial',
  enrolled: 'Inscrito',
  paid: 'Pagado',
  noreply: 'Sin respuesta',
  support: 'Soporte',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Conversation document shape (container `whatsapp`). */
export interface WaConversation extends BaseEntity {
  type: 'conversation';
  waContactId: string;
  displayName: string;
  phone: string;
  status: WaStatus;
  assignedTo?: string | null;
  aiMode: WaAiMode;
  leadState: WaLeadState;
  lastInboundAt?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unread: number;
  tags?: string[];
  /** Program/course of interest, e.g. "drywall", "melamina". Free-form. */
  program?: string | null;
  /** ISO 8601 datetime of the scheduled in-person visit (when leadState = "visit"). */
  visitAt?: string | null;
}

/** Media/file attachment on a message (MVP: client-side object URLs in mock mode). */
export interface WaAttachment {
  kind: 'image' | 'document';
  url: string;
  name?: string;
  mimeType?: string;
}

/** Message document shape (container `whatsapp`). */
export interface WaMessage extends BaseEntity {
  type: 'message';
  conversationId: string;
  waMessageId?: string | null;
  sender: WaSender;
  kind: 'text' | 'image' | 'document';
  text: string;
  status: WaMessageStatus;
  ts: string;
  aiSuggested: boolean;
  confidence?: number | null;
  attachments?: WaAttachment[];
}

/** Filters for `GET /wa/conversations`. */
export interface WaConversationListParams extends ListParams {
  search?: string;
  status?: WaStatus;
}

/** Body for `PATCH /wa/conversations/{id}`. */
export interface WaConversationUpdate {
  status?: WaStatus;
  assignedTo?: string | null;
  aiMode?: WaAiMode;
  leadState?: WaLeadState;
  program?: string | null;
  visitAt?: string | null;
}

/** Body for `POST /wa/conversations/{id}/messages`. */
export interface WaSendBody {
  text: string;
  attachments?: WaAttachment[];
}

/** Response from `POST /wa/conversations/{id}/ai-suggest`. */
export interface WaAiSuggestion {
  suggestion: string;
  confidence: number;
}

/** Optional body for `POST /wa/conversations/{id}/ai-suggest` (assisted mode). */
export interface WaAiSuggestBody {
  /** Agent instruction to steer the draft, e.g. `dile que solo atendemos los lunes`. */
  instruction?: string;
}

/** Compose-assistant actions for `POST /wa/messages/improve`. */
export type WaImproveAction =
  | 'rewrite'
  | 'proofread'
  | 'concise'
  | 'longer'
  | 'casual'
  | 'professional'
  | 'confident'
  | 'enthusiastic'
  | 'custom';

/** Body / response for `POST /wa/messages/improve`. */
export interface WaImproveBody {
  text: string;
  action: WaImproveAction;
  instruction?: string;
}
export interface WaImproveResult {
  text: string;
}

// ---------------------------------------------------------------------------
// API functions (with offline mock fallback)
// ---------------------------------------------------------------------------

/** List conversations with optional search and status filter. */
export const getConversations = (
  client: ApiClient,
  params?: WaConversationListParams,
): Promise<PaginatedResponse<WaConversation>> =>
  withMock(
    () =>
      client.get<PaginatedResponse<WaConversation>>('/wa/conversations', {
        params: params as Record<string, string | number | boolean | undefined>,
      }),
    () => mockConversations(params),
  );

/** Get a single conversation by ID. */
export const getConversation = (
  client: ApiClient,
  id: string,
): Promise<WaConversation> =>
  withMock(
    () => client.get<WaConversation>(`/wa/conversations/${encodeURIComponent(id)}`),
    () => mockConversation(id),
  );

/** Patch status/assignedTo/aiMode/leadState on a conversation. */
export const updateConversation = (
  client: ApiClient,
  id: string,
  body: WaConversationUpdate,
): Promise<WaConversation> =>
  withMock(
    () =>
      client.put<WaConversation>(`/wa/conversations/${encodeURIComponent(id)}`, body),
    () => mockUpdateConversation(id, body),
  );

/** List the message thread for a conversation. */
export const getMessages = (
  client: ApiClient,
  conversationId: string,
  params?: ListParams,
): Promise<PaginatedResponse<WaMessage>> =>
  withMock(
    () =>
      client.get<PaginatedResponse<WaMessage>>(
        `/wa/conversations/${encodeURIComponent(conversationId)}/messages`,
        { params: params as Record<string, string | number | boolean | undefined> },
      ),
    () => mockMessages(conversationId, params?.limit, params?.offset),
  );

/** Agent manual reply (stub send). */
export const sendMessage = (
  client: ApiClient,
  conversationId: string,
  body: WaSendBody,
): Promise<WaMessage> =>
  withMock(
    () =>
      client.post<WaMessage>(
        `/wa/conversations/${encodeURIComponent(conversationId)}/messages`,
        body,
      ),
    () => mockSend(conversationId, body),
  );

/** Stub AI suggestion: returns suggested text + confidence. Optional `instruction`
 *  (assisted mode) lets the agent steer the draft. */
export const aiSuggest = (
  client: ApiClient,
  conversationId: string,
  instruction?: string,
): Promise<WaAiSuggestion> =>
  withMock(
    () =>
      client.post<WaAiSuggestion>(
        `/wa/conversations/${encodeURIComponent(conversationId)}/ai-suggest`,
        { instruction } satisfies WaAiSuggestBody,
      ),
    () => mockSuggest(conversationId, instruction),
  );

/** Compose assistant: rewrite/proofread/adjust the agent's draft. Stub. */
export const improveMessage = (
  client: ApiClient,
  body: WaImproveBody,
): Promise<WaImproveResult> =>
  withMock(
    () => client.post<WaImproveResult>('/wa/messages/improve', body),
    () => ({ text: mockImprove(body.text, body.action, body.instruction) }),
  );

// ---------------------------------------------------------------------------
// Mock fallback
//
// Lets `pnpm dev` render a working inbox with no WhatsApp number/backend.
// Forced via NEXT_PUBLIC_WA_MOCK, or automatic on network errors (backend
// unreachable). HTTP errors (ApiError) propagate so real failures stay visible.
// ---------------------------------------------------------------------------

const WA_MOCK =
  typeof process !== 'undefined' &&
  Boolean(
    (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_WA_MOCK'],
  );

async function withMock<T>(
  real: () => Promise<T>,
  mock: () => T,
): Promise<T> {
  if (WA_MOCK) return mock();
  try {
    return await real();
  } catch (err) {
    // Network error (backend unreachable) → fall back to mock. Re-throw real HTTP errors.
    if (isApiError(err)) throw err;
    return mock();
  }
}

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

const mockAudit = {
  clerkUserId: 'mock',
  email: 'mock@espaciopro.pe',
  displayName: 'Mock',
};

function seedConversation(
  id: string,
  displayName: string,
  phone: string,
  status: WaStatus,
  leadState: WaLeadState,
  aiMode: WaAiMode,
  preview: string,
  unread: number,
  minsAgo: number,
  tags: string[] = [],
  program: string | null = null,
  visitAt: string | null = null,
): WaConversation {
  return {
    id,
    type: 'conversation',
    active: true,
    createdAt: iso(minsAgo + 1440),
    createdBy: mockAudit,
    updatedAt: iso(minsAgo),
    updatedBy: mockAudit,
    waContactId: phone.replace('+', ''),
    displayName,
    phone,
    status,
    assignedTo: null,
    aiMode,
    leadState,
    lastInboundAt: iso(minsAgo),
    lastMessageAt: iso(minsAgo),
    lastMessagePreview: preview,
    unread,
    tags,
    program,
    visitAt,
  };
}

// Visit two days from now at 17:00 local, ISO.
function visitSample(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

const MOCK_CONVERSATIONS: WaConversation[] = [
  seedConversation('c1', 'Ana Quispe', '+51999111222', 'open', 'interested', 'assist', '¿Cuáles son los horarios?', 2, 4, ['Mañana'], 'drywall'),
  seedConversation('c2', 'Luis Ramos', '+51988333444', 'pending', 'new', 'off', 'Hola, quiero info de precios', 1, 22, ['Precios'], 'melamina'),
  seedConversation('c3', 'María Torres', '+51977555666', 'open', 'enrolled', 'assist', 'Gracias, ya me inscribí', 0, 95, ['VIP'], 'melamina'),
  seedConversation('c4', 'Carlos Díaz', '+51966777888', 'closed', 'paid', 'off', 'Pago confirmado, ¡muchas gracias!', 0, 320, [], 'drywall'),
  seedConversation('c5', 'Sofía Vega', '+51955999000', 'open', 'support', 'autopilot', '¿Dónde queda la academia?', 3, 9, ['Soporte'], 'drywall'),
  seedConversation('c6', 'Jorge Ríos', '+51944222111', 'open', 'visit', 'assist', '¿Puedo ir a conocer la academia antes?', 1, 14, ['Tarde'], 'melamina', visitSample()),
];

const MOCK_MESSAGES: Record<string, WaMessage[]> = {
  c1: buildLongThread('c1', 'Ana Quispe', 64),
  c2: seedThread('c2', [
    ['customer', 'Hola, quiero info de precios'],
    ['bot', 'El curso básico cuesta S/350 al mes. ¿Te gustaría inscribirte?'],
  ]),
  c3: buildLongThread('c3', 'María Torres', 28),
  c4: seedThread('c4', [
    ['customer', '¿Cuánto es la matrícula?'],
    ['agent', 'La matrícula es S/100. Pago confirmado, ¡muchas gracias!'],
  ]),
  c5: seedThread('c5', [
    ['customer', '¿Dónde queda la academia?'],
    ['bot', 'Estamos en Av. Principal 123, Lima. ¡Te esperamos!'],
  ]),
  c6: seedThread('c6', [
    ['customer', 'Hola, antes de inscribirme me gustaría conocer la academia.'],
    ['agent', '¡Claro! Puedes visitarnos de lunes a viernes de 9am a 6pm. ¿Qué día te queda bien?'],
    ['customer', '¿Puedo ir el sábado por la tarde?'],
    ['agent', 'Los sábados atendemos hasta el mediodía. ¿Te parece el viernes 5pm?'],
  ]),
};

function seedThread(
  conversationId: string,
  rows: [WaSender, string][],
): WaMessage[] {
  return rows.map((row, i) => ({
    id: `${conversationId}-m${i}`,
    type: 'message',
    active: true,
    createdAt: iso(rows.length - i),
    createdBy: mockAudit,
    updatedAt: iso(rows.length - i),
    updatedBy: mockAudit,
    conversationId,
    waMessageId: `wamid.mock.${conversationId}.${i}`,
    sender: row[0],
    kind: 'text',
    text: row[1],
    status: row[0] === 'customer' ? 'read' : 'sent',
    ts: iso(rows.length - i),
    aiSuggested: row[0] === 'bot',
    confidence: row[0] === 'bot' ? 0.82 : null,
  }));
}

function mockConversations(
  params?: WaConversationListParams,
): PaginatedResponse<WaConversation> {
  let items = MOCK_CONVERSATIONS.filter((c) => c.active);
  if (params?.status) items = items.filter((c) => c.status === params.status);
  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }
  // Return a fresh array of fresh objects so React Query detects in-place edits
  // (otherwise it holds the live MOCK_CONVERSATIONS ref and skips re-render).
  items = items.map((c) => ({ ...c }));
  return { items, total: items.length, limit: params?.limit ?? 25, offset: params?.offset ?? 0 };
}

function mockConversation(id: string): WaConversation {
  const found = MOCK_CONVERSATIONS.find((c) => c.id === id) ?? MOCK_CONVERSATIONS[0];
  return { ...found };
}

function mockUpdateConversation(id: string, body: WaConversationUpdate): WaConversation {
  const idx = MOCK_CONVERSATIONS.findIndex((c) => c.id === id);
  // Mirror the backend: empty-string program/visitAt clears the field (→ null).
  const patch: WaConversationUpdate = { ...body };
  if (patch.visitAt === '') patch.visitAt = null;
  if (patch.program === '') patch.program = null;
  if (idx >= 0) MOCK_CONVERSATIONS[idx] = { ...MOCK_CONVERSATIONS[idx], ...patch };
  return { ...MOCK_CONVERSATIONS[idx >= 0 ? idx : 0] };
}

function mockMessages(conversationId: string, limit = 25, offset = 0): PaginatedResponse<WaMessage> {
  const all = MOCK_MESSAGES[conversationId] ?? [];
  // Newest first (DESC), then page — mirrors the backend contract.
  const desc = [...all].reverse();
  const items = desc.slice(offset, offset + limit);
  return { items, total: all.length, limit, offset };
}

/** Builds a long, realistic Spanish thread to preview pagination with many messages. */
function buildLongThread(conversationId: string, name: string, count: number): WaMessage[] {
  const first = name.split(' ')[0];
  const customerLines = [
    'Hola, ¿cuáles son los horarios de los cursos?',
    '¿Tienen clases por la tarde?',
    '¿Cuánto cuesta la matrícula?',
    '¿El curso incluye material?',
    '¿Dónde queda la academia?',
    '¿Puedo pagar en dos partes?',
    'Perfecto, gracias.',
    '¿Hacen descuento por hermanos?',
    '¿Cuándo empieza el próximo ciclo?',
    'Me interesa, ¿cómo me inscribo?',
  ];
  const agentLines = [
    `Hola ${first}, con gusto te ayudo.`,
    'Tenemos horarios de mañana (8-10am) y tarde (6-8pm).',
    'La matrícula es S/100 y la mensualidad S/350.',
    'Sí, el material está incluido en la mensualidad.',
    'Estamos en Av. Principal 123, Lima.',
    'Claro, puedes pagar en dos cuotas sin recargo.',
    'Te paso el link de inscripción: espaciopro.pe/inscripcion',
    'El próximo ciclo empieza el primer lunes del mes.',
    '¿Te reservo un cupo?',
    'Quedo atento a cualquier consulta. 😊',
  ];
  const out: WaMessage[] = [];
  for (let i = 0; i < count; i++) {
    const isCustomer = i % 2 === 0;
    const minsAgo = (count - i) * 7; // older first
    const line = isCustomer
      ? customerLines[i % customerLines.length]
      : agentLines[i % agentLines.length];
    out.push({
      id: `${conversationId}-h${i}`,
      type: 'message',
      active: true,
      createdAt: iso(minsAgo),
      createdBy: mockAudit,
      updatedAt: iso(minsAgo),
      updatedBy: mockAudit,
      conversationId,
      waMessageId: `wamid.mock.${conversationId}.h${i}`,
      sender: isCustomer ? 'customer' : 'agent',
      kind: 'text',
      text: line,
      status: isCustomer ? 'read' : 'sent',
      ts: iso(minsAgo),
      aiSuggested: false,
      confidence: null,
    });
  }
  return out;
}

function mockSend(conversationId: string, body: WaSendBody): WaMessage {
  const attachments = body.attachments ?? [];
  const hasImage = attachments.some((a) => a.kind === 'image');
  const msg: WaMessage = {
    id: `${conversationId}-m${Date.now()}`,
    type: 'message',
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: mockAudit,
    updatedAt: new Date().toISOString(),
    updatedBy: mockAudit,
    conversationId,
    waMessageId: `wamid.mock.${Date.now()}`,
    sender: 'agent',
    kind: attachments.length ? (hasImage ? 'image' : 'document') : 'text',
    text: body.text,
    status: 'sent',
    ts: new Date().toISOString(),
    aiSuggested: false,
    confidence: null,
    attachments: attachments.length ? attachments : undefined,
  };
  (MOCK_MESSAGES[conversationId] ??= []).push(msg);
  return msg;
}

function mockSuggest(conversationId: string, instruction?: string): WaAiSuggestion {
  const conv = mockConversation(conversationId);
  const first = conv.displayName.split(' ')[0];
  const hint = instruction?.trim();
  if (hint) {
    return {
      suggestion: `Hola ${first}, gracias por tu mensaje. Entiendo 🙂. ${rephraseInstruction(hint)} ¿Te puedo ayudar con algo más?`,
      confidence: 0.8,
    };
  }
  return {
    suggestion: `Hola ${first}, gracias por escribir. Tenemos horarios de mañana y tarde desde S/350. ¿Quieres que te envíe el link de inscripción?`,
    confidence: 0.78,
  };
}

/** Heuristic placeholder for the MAF orchestrator (Fase 3): strips Spanish lead-ins
 *  ("dile que", "responde que", ...) and capitalizes the agent instruction. */
function rephraseInstruction(instruction: string): string {
  let s = instruction.trim();
  const leadIns = [
    'dile que', 'dile', 'responde que', 'responde', 'contesta que', 'contesta',
    'contestale que', 'menciona que', 'avisale que', 'indicale que', 'explicale que', 'que ',
  ];
  const lower = s.toLowerCase();
  for (const lead of leadIns) {
    if (lower.startsWith(lead)) {
      s = s.slice(lead.length).trimStart();
      break;
    }
  }
  if (!s) return instruction.trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

/** Heuristic compose-assistant transform (rewrite/proofread/adjust). Stub for Fase 3. */
function mockImprove(text: string, action: WaImproveAction, instruction?: string): string {
  const t = text.trim();
  switch (action) {
    case 'proofread': {
      let s = t.charAt(0).toUpperCase() + t.slice(1);
      if (!/[.!?]$/.test(s)) s += '.';
      return s;
    }
    case 'concise':
      return (t.split(/[.\n]/)[0] || t).trim().replace(/\.*$/, '') + '.';
    case 'longer':
      return `${t} Quedamos atentos a cualquier consulta adicional.`;
    case 'casual':
      return `¡Hola! ${t} 😊`;
    case 'professional':
      return `Estimado/a, ${t} Quedamos atentos.`;
    case 'confident':
      return `${t} Cuente con nosotros para lo que necesite.`;
    case 'enthusiastic':
      return `¡${t.replace(/[.!\s]+$/, '')}! 🎉`;
    case 'custom':
      return instruction?.trim() ? `${t} (${instruction.trim()})` : t;
    case 'rewrite':
    default:
      return `En otras palabras: ${t}`;
  }
}
