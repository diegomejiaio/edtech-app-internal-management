/**
 * Shared catalog of AI agents for the CRM. The Agents screen manages the full config
 * (instructions, tools, intents, threshold); the inbox uses this list to assign an agent
 * to a conversation. Static mock for now (real agents/config persist in Fase 3/4).
 */

export interface CrmAgent {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

export const CRM_AGENTS: CrmAgent[] = [
  { id: 'ag-general', name: 'Asistente general', description: 'FAQ: horarios, precios, ubicación, inscripción', isDefault: true },
  { id: 'ag-drywall', name: 'Especialista Drywall', description: 'Enfocado en el programa de Drywall', isDefault: false },
  { id: 'ag-melamina', name: 'Especialista Melamina', description: 'Enfocado en el programa de Melamina', isDefault: false },
  { id: 'ag-visitas', name: 'Coordinador de visitas', description: 'Agenda y confirma visitas presenciales', isDefault: false },
];

export const DEFAULT_AGENT = CRM_AGENTS.find((a) => a.isDefault) ?? CRM_AGENTS[0];

export function agentName(id?: string | null): string {
  return CRM_AGENTS.find((a) => a.id === id)?.name ?? DEFAULT_AGENT.name;
}
