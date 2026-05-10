import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type {
  Company,
  CompanyCreate,
  CompanyUpdate,
  CursorPaginatedResponse,
  CursorPaginationParams,
} from "@/types";

interface UseCompaniesParams extends CursorPaginationParams {
  tenant_id?: string;
  is_active?: boolean;
  has_credentials?: boolean;
  has_api_credentials?: boolean;
  search?: string;
}

export function useCompanies(params: UseCompaniesParams = {}) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["companies", params],
    queryFn: async () => {
      const token = await getToken();
      return api.get<CursorPaginatedResponse<Company>>("/companies", {
        token,
        params: {
          limit: params.limit || 50,
          cursor: params.cursor,
          tenant_id: params.tenant_id,
          is_active: params.is_active?.toString(),
          has_credentials: params.has_credentials?.toString(),
          has_api_credentials: params.has_api_credentials?.toString(),
          search: params.search,
        },
      });
    },
  });
}

/**
 * Fetch a single company by ID.
 */
export function useCompany(companyId: string | null | undefined) {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) throw new Error("Company ID is required");
      const token = await getToken();
      return api.get<Company>(`/companies/${companyId}`, { token });
    },
    enabled: !!companyId,
  });
}

interface UseInfiniteCompaniesOptions extends Omit<
  UseCompaniesParams,
  "cursor"
> {
  enabled?: boolean;
}

export function useInfiniteCompanies({
  enabled = true,
  ...params
}: UseInfiniteCompaniesOptions = {}) {
  const { getToken } = useAuthContext();

  return useInfiniteQuery({
    queryKey: ["companies", "infinite", params],
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      return api.get<CursorPaginatedResponse<Company>>("/companies", {
        token,
        params: {
          limit: params.limit || 50,
          cursor: pageParam,
          tenant_id: params.tenant_id,
          is_active: params.is_active?.toString(),
          has_credentials: params.has_credentials?.toString(),
          has_api_credentials: params.has_api_credentials?.toString(),
          search: params.search,
        },
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled,
  });
}

export function useCreateCompany() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CompanyCreate) => {
      const token = await getToken();
      return api.post<Company>("/companies", data, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompanyUpdate }) => {
      const token = await getToken();
      return api.patch<Company>(`/companies/${id}`, data, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

// Credentials update types
export interface CredentialsUpdate {
  sol_user: string;
  sol_password: string;
}

export function useUpdateCredentials() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      data,
    }: {
      companyId: string;
      data: CredentialsUpdate;
    }) => {
      const token = await getToken();
      return api.patch<{ message: string }>(
        `/companies/${companyId}/credentials`,
        data,
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useDeleteCompany() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      const token = await getToken();
      return api.delete<{ message: string }>(`/companies/${companyId}`, {
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

// API Credentials (client_id + client_secret)
export interface ApiCredentialsUpdate {
  client_id: string;
  client_secret: string;
}

export function useUpdateApiCredentials() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      data,
    }: {
      companyId: string;
      data: ApiCredentialsUpdate;
    }) => {
      const token = await getToken();
      return api.patch<{ message: string }>(
        `/companies/${companyId}/api-credentials`,
        data,
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useDeleteApiCredentials() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      const token = await getToken();
      return api.delete<{ message: string }>(
        `/companies/${companyId}/api-credentials`,
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
