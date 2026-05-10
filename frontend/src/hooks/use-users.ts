import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { api } from "@/lib/api";
import type {
  UserResponse,
  UserListResponse,
  InviteUserRequest,
  UpdateUserRequest,
} from "@/types";

/**
 * Fetch all users in the current tenant
 * Excludes master users (FR-002)
 * Sorted by status (active first) then by email
 */
export function useUsers() {
  const { getToken } = useAuthContext();

  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const token = await getToken();
      return api.get<UserListResponse>("/users", { token });
    },
  });
}

/**
 * Invite a new user to the tenant
 * Creates Clerk invitation and embeds user in tenant with status: pending
 */
export function useInviteUser() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InviteUserRequest) => {
      const token = await getToken();
      return api.post<UserResponse>("/users/invite", data, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Update user role and/or assigned companies
 * Business rules:
 * - FR-011: Cannot demote last admin
 * - FR-012: Promoting to admin clears assigned_company_ids
 */
export function useUpdateUser() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateUserRequest;
    }) => {
      const token = await getToken();
      return api.patch<UserResponse>(`/users/${userId}`, data, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Remove user from tenant
 * - Pending users: revokes Clerk invitation
 * - Active users: removes from Clerk organization
 * Business rules:
 * - FR-011: Cannot remove last active admin
 */
export function useRemoveUser() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      return api.delete<{ message: string }>(`/users/${userId}`, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Helper hook for assigning companies to a member
 */
export function useAssignCompanies() {
  const updateUser = useUpdateUser();

  return {
    ...updateUser,
    assign: (userId: string, companyIds: string[]) =>
      updateUser.mutate({
        userId,
        data: { assigned_company_ids: companyIds },
      }),
    assignAsync: (userId: string, companyIds: string[]) =>
      updateUser.mutateAsync({
        userId,
        data: { assigned_company_ids: companyIds },
      }),
  };
}

/**
 * Sync users from Clerk organization to tenant
 * Used to import existing Clerk org members that aren't in the tenant yet
 */
export function useSyncUsers() {
  const { getToken } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.post<{
        message: string;
        users_added: number;
        total_clerk_members: number;
      }>("/users/sync", {}, { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
