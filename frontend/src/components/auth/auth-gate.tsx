'use client';

/**
 * Auth gate that protects routes behind Clerk authentication.
 *
 * Wraps protected pages to:
 * 1. Show a loading spinner while Clerk initializes.
 * 2. Redirect unauthenticated users to /sign-in.
 * 3. Optionally enforce a specific role (defaults to 'admin' for v1).
 *
 * Usage:
 *   <AuthGate>
 *     <ProtectedContent />
 *   </AuthGate>
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { env } from '@/lib/env';
import type { AppRole } from '@/components/auth';

interface AuthGateProps {
  children: ReactNode;
  /** Required role. Defaults to `'admin'` (the only v1 role). */
  role?: AppRole;
  /** URL to redirect unauthenticated users to. */
  signInUrl?: string;
  /** Custom loading indicator. */
  loadingFallback?: ReactNode;
  /** Custom forbidden indicator (authenticated but wrong role). */
  forbiddenFallback?: ReactNode;
}

function DefaultLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function DefaultForbidden() {
  const { signOut } = useClerk();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <p className="text-lg font-semibold text-destructive">Acceso denegado</p>
      <p className="text-sm text-muted-foreground">
        No tienes permisos para ver esta página.
      </p>
      <p className="text-xs text-muted-foreground">
        Si acabas de configurar tu rol en Clerk, cierra sesión y vuelve a entrar.
      </p>
      <button
        onClick={() => signOut({ redirectUrl: '/sign-in' })}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export function AuthGate({
  children,
  role = 'admin',
  signInUrl = '/sign-in',
  loadingFallback,
  forbiddenFallback,
}: AuthGateProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgRole, orgId, getToken } = useAuth();
  const { setActive } = useClerk();

  // Auto-activate org from env if signed in but no active org
  useEffect(() => {
    if (!isLoaded || !isSignedIn || orgId) return;
    if (env.clerkOrgId) {
      console.log('[AuthGate] Auto-activating org:', env.clerkOrgId);
      setActive({ organization: env.clerkOrgId });
    }
  }, [isLoaded, isSignedIn, orgId, setActive]);

  // Debug: log Clerk session + decoded JWT
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    console.log('[AuthGate] orgId:', orgId);
    console.log('[AuthGate] orgRole:', orgRole);

    getToken().then((token) => {
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('[AuthGate] JWT payload:', payload);
      } catch {
        console.log('[AuthGate] Raw token:', token);
      }
    });
  }, [isLoaded, isSignedIn, orgId, orgRole, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(signInUrl);
    }
  }, [isLoaded, isSignedIn, router, signInUrl]);

  if (!isLoaded || !isSignedIn) {
    return <>{loadingFallback ?? <DefaultLoading />}</>;
  }

  // Parse org role: Clerk sends "org:admin" → we need "admin"
  const parsedRole = orgRole?.startsWith('org:') ? orgRole.slice(4) : orgRole;
  if (role && parsedRole !== role) {
    return <>{forbiddenFallback ?? <DefaultForbidden />}</>;
  }

  return <>{children}</>;
}
