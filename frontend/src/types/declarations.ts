// Declaration types for period declaration workflow

export interface DeclarationSummary {
  valid_count: number;
  rejected_count: number;
  observed_count: number;
}

export interface DeclarationHistoryEntry {
  event: "declared" | "reopened";
  at: string;
  by_id: string;
  by_name: string;
  reason: string | null;
}

export interface Declaration {
  id: string;
  tenant_id: string;
  company_id: string;
  year: string;
  period: string;
  type: string;
  status: "open" | "declared";
  summary: DeclarationSummary | null;
  history: DeclarationHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface DeclareRequest {
  summary: DeclarationSummary;
  reason?: string;
}

export interface ReopenRequest {
  reason: string;
}
