'use client';

/**
 * Role gate component for Espacio Pro v1.
 *
 * Uses Clerk Organizations for role management. The role comes from
 * `useAuth().orgRole` as `org:<role>` (e.g. `org:admin`).
 * v1 scope: only `admin` is enforced.
 * Model is prepared for `seller`/`teacher` post-MVP.
 */

import type { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';

/** Supported roles — only `admin` is enforced in v1. */
export type AppRole = 'admin' | 'seller' | 'teacher';

interface RequireRoleProps {
  role: AppRole;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Extracts the role name from Clerk's `org:<role>` format. */
function parseOrgRole(orgRole: string | null | undefined): string | null {
  if (!orgRole) return null;
  return orgRole.startsWith('org:') ? orgRole.slice(4) : orgRole;
}

function useHasRole(requiredRole: AppRole): boolean {
  const { isLoaded, isSignedIn, orgRole } = useAuth();

  if (!isLoaded || !isSignedIn) return false;

  const role = parseOrgRole(orgRole);
  if (!role) return false;

  return role === requiredRole;
}

export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const hasRole = useHasRole(role);
  if (!hasRole) return <>{fallback}</>;
  return <>{children}</>;
}

/** Hook version for programmatic role checks. */
export function useRole(role: AppRole): boolean {
  return useHasRole(role);
}

export function useIsAdmin(): boolean {
  return useHasRole('admin');
}
