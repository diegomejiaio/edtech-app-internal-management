import { api } from "@/lib/api";
import type { Company, CompanyContact, CursorPaginatedResponse } from "@/types";

// =============================================================================
// fetchAllCompaniesWithContacts
// Paginates exhaustively through all companies and fetches their contacts.
// =============================================================================

interface CompanyWithContacts {
  company: Company;
  contacts: CompanyContact[];
}

export async function fetchAllCompaniesWithContacts(
  token: string,
): Promise<CompanyWithContacts[]> {
  // 1. Fetch all companies (paginated)
  const allCompanies: Company[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ limit: "500" });
    if (cursor) params.set("cursor", cursor);

    const response = await api.get<CursorPaginatedResponse<Company>>(
      `/companies?${params.toString()}`,
      { token },
    );
    allCompanies.push(...response.items);
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  // 2. Fetch contacts in parallel, batched to avoid overwhelming the API
  const BATCH_SIZE = 10;
  const contactsMap = new Map<string, CompanyContact[]>();

  for (let i = 0; i < allCompanies.length; i += BATCH_SIZE) {
    const batch = allCompanies.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (company) => {
        try {
          const response = await api.get<
            CursorPaginatedResponse<CompanyContact>
          >(`/companies/${company.id}/contacts`, { token });
          return { companyId: company.id, contacts: response.items };
        } catch {
          return { companyId: company.id, contacts: [] };
        }
      }),
    );
    results.forEach(({ companyId, contacts }) =>
      contactsMap.set(companyId, contacts),
    );
  }

  return allCompanies.map((company) => ({
    company,
    contacts: contactsMap.get(company.id) ?? [],
  }));
}

// =============================================================================
// generateCompaniesCSV
// Builds a UTF-8 CSV (with BOM for Excel compatibility) from companies + contacts.
// =============================================================================

const CSV_HEADERS = [
  "RUC",
  "Razón Social",
  "Estado",
  "Clave SOL",
  "API Key",
  "Contacto Nombre",
  "Contacto Email",
  "Contacto Rol",
  "Contacto Principal",
];

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function generateCompaniesCSV(data: CompanyWithContacts[]): string {
  const rows: string[][] = [CSV_HEADERS];

  for (const { company, contacts } of data) {
    const estado = company.is_active ? "Activo" : "Inactivo";
    const claveSol = company.has_credentials ? "Sí" : "No";
    const apiKey = company.has_api_credentials ? "Sí" : "No";

    if (contacts.length === 0) {
      rows.push([
        company.ruc,
        company.business_name,
        estado,
        claveSol,
        apiKey,
        "-",
        "-",
        "-",
        "-",
      ]);
    } else {
      for (const contact of contacts) {
        rows.push([
          company.ruc,
          company.business_name,
          estado,
          claveSol,
          apiKey,
          contact.name,
          contact.email,
          contact.role || "-",
          contact.is_primary ? "Sí" : "No",
        ]);
      }
    }
  }

  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  return "\ufeff" + csv; // BOM for Excel UTF-8 compatibility
}

// =============================================================================
// downloadCSV
// Triggers a browser file download for the given CSV string.
// =============================================================================

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
