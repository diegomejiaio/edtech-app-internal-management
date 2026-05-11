'use client';

/**
 * Permission gate — thin wrapper for v1.
 *
 * In v1 (admin-only), all permissions are granted to signed-in admin users.
 * Post-MVP this will integrate with Clerk's fine-grained permissions
 * when `seller` and `teacher` roles are added.
 */

import type { ReactNode } from 'react';
import { useIsAdmin } from './require-role';

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({
  children,
  fallback = null,
}: RequirePermissionProps) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}

/** Hook version — in v1 returns true for admin users. */
export function usePermission(_permission: string): boolean {
  return useIsAdmin();
}
