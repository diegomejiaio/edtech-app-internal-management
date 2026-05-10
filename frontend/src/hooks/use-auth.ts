/**
 * Authentication hooks with DEV_MODE support
 *
 * When DEV_MODE=true:
 *   - Returns mock user data without Clerk
 *   - No API calls to /auth/me
 *   - Instant loading (no async)
 *
 * When DEV_MODE=false:
 *   - Uses Clerk for authentication
 *   - Fetches user context from API
 */

import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/providers/auth-provider";
import { DEV_MODE, DEV_DEFAULTS } from "@/lib/env";
import { api } from "@/lib/api";
import type { UserContext } from "@/types";

/**
 * Hook to get auth state
 *
 * Uses our AuthContext which bridges to Clerk in production
 * or provides mock data in DEV_MODE
 */
export function useAuthState() {
  return useAuthContext();
}

/**
 * Hook to get current authenticated user context
 */
export function useCurrentUser() {
  const auth = useAuthState();

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<UserContext> => {
      if (DEV_MODE) {
        // Return mock user context matching backend dev defaults
        return {
          user_id: DEV_DEFAULTS.userId,
          tenant_id: DEV_DEFAULTS.tenantId,
          role: DEV_DEFAULTS.userRole,
          email: DEV_DEFAULTS.userEmail,
          name: DEV_DEFAULTS.userName,
          assigned_companies: [], // Master has access to all
        };
      }

      // Production - fetch from API
      const token = await auth.getToken();
      return api.get<UserContext>("/auth/me", { token: token ?? undefined });
    },
    enabled: auth.isSignedIn,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get user role and permissions
 *
 * Uses the role from AuthContext directly (comes from Clerk JWT or DEV_MODE mock)
 */
export function useUserRole() {
  const auth = useAuthState();

  // Role comes directly from auth context (Clerk JWT or dev mock)
  const role = auth.role;

  const isMaster = role === "master";
  const isAdmin = role === "admin";
  const isMember = role === "member";

  return {
    role,
    isMaster,
    isAdmin,
    isMember,
    // Permission helpers (matches backend AdminAuth logic)
    canManageTenant: isAdmin || isMaster, // Can manage users, settings, etc.
    tenantId: auth.orgId,
    assignedCompanies: [] as string[], // TODO: fetch from user context if needed
    isLoading: !auth.isLoaded,
  };
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated() {
  const auth = useAuthState();
  return auth.isLoaded && auth.isSignedIn;
}

/**
 * Hook to get auth token for API calls
 * In DEV_MODE, returns null (API client adds X-Dev-Tenant header instead)
 */
export function useAuthToken() {
  const auth = useAuthState();

  return {
    getToken: async (): Promise<string | null> => {
      if (DEV_MODE) {
        return null; // API client handles dev mode via X-Dev-Tenant
      }
      return auth.getToken();
    },
    isDevMode: DEV_MODE,
  };
}
