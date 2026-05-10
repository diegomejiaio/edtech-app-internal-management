import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type { Batch, BatchDetail } from "@/types";

interface BatchListResponse {
  items: Batch[];
  next_cursor: string | null;
  has_more: boolean;
}

export function useBatchesAdmin(limit = 100) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["admin", "batches", limit],
    queryFn: async () => {
      const token = await getToken();
      return api.get<BatchListResponse>(`/batches?limit=${limit}`, { token });
    },
  });
}

export function useBatchDetail(batchId: string | undefined) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["admin", "batches", batchId],
    queryFn: async () => {
      const token = await getToken();
      return api.get<BatchDetail>(`/batches/${batchId}`, { token });
    },
    enabled: !!batchId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      // Poll every 3s while batch is running
      return data.status === "running" ? 3000 : false;
    },
  });
}
