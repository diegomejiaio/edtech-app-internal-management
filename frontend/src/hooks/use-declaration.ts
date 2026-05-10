import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthToken } from "@/hooks/use-auth";
import type { Declaration, DeclareRequest, ReopenRequest } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Optimistically flip `is_declared` for a company in the stats-by-company cache. */
function updateStatsCacheDeclaration(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  isDeclared: boolean,
) {
  // The cache may exist for multiple period keys — update all of them
  queryClient.setQueriesData<{
    period: string | null;
    items: { company_id: string; is_declared: boolean }[];
  }>({ queryKey: ["vouchers-stats-by-company"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      items: old.items.map((item) =>
        item.company_id === companyId
          ? { ...item, is_declared: isDeclared }
          : item,
      ),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET declaration for a period
// Returns null (200) when no declaration exists (period is open)
// ─────────────────────────────────────────────────────────────────────────────

export function useDeclaration(
  companyId: string | undefined,
  year: string | undefined,
  period: string | undefined,
) {
  const { getToken } = useAuthToken();

  return useQuery<Declaration | null>({
    queryKey: ["declaration", companyId, year, period],
    queryFn: async () => {
      const token = await getToken();
      return api.get<Declaration | null>(
        `/companies/${companyId}/declarations/${year}/${period}`,
        { token },
      );
    },
    enabled: Boolean(companyId && year && period),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST declare — mark a period as declared
// ─────────────────────────────────────────────────────────────────────────────

interface DeclareVariables {
  companyId: string;
  year: string;
  period: string;
  payload: DeclareRequest;
}

export function useDeclare() {
  const { getToken } = useAuthToken();
  const queryClient = useQueryClient();

  return useMutation<Declaration, Error, DeclareVariables>({
    mutationFn: async ({ companyId, year, period, payload }) => {
      const token = await getToken();
      return api.post<Declaration>(
        `/companies/${companyId}/declarations/${year}/${period}/declare`,
        payload,
        { token },
      );
    },
    onSuccess: (data, { companyId, year, period }) => {
      // Update the declaration cache with the returned data (no refetch needed)
      queryClient.setQueryData(["declaration", companyId, year, period], data);
      // Instantly reflect "Declarado" in the company list without refetch
      updateStatsCacheDeclaration(queryClient, companyId, true);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST reopen — reopen a declared period
// ─────────────────────────────────────────────────────────────────────────────

interface ReopenVariables {
  companyId: string;
  year: string;
  period: string;
  payload: ReopenRequest;
}

export function useReopen() {
  const { getToken } = useAuthToken();
  const queryClient = useQueryClient();

  return useMutation<Declaration, Error, ReopenVariables>({
    mutationFn: async ({ companyId, year, period, payload }) => {
      const token = await getToken();
      return api.post<Declaration>(
        `/companies/${companyId}/declarations/${year}/${period}/reopen`,
        payload,
        { token },
      );
    },
    onSuccess: (data, { companyId, year, period }) => {
      // Update the declaration cache with the returned data (no refetch needed)
      queryClient.setQueryData(["declaration", companyId, year, period], data);
      // Instantly reflect "Sin declarar" in the company list without refetch
      updateStatsCacheDeclaration(queryClient, companyId, false);
    },
  });
}
