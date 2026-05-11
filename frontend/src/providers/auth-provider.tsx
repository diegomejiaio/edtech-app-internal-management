'use client';

/**
 * Authentication provider for Espacio Pro v1.
 *
 * Wraps the app in Clerk's ClerkProvider. No DEV_MODE bypass —
 * local dev uses a real Clerk instance (see docs/02-architecture.md §3).
 *
 * v1 role scope: admin only. The role claim comes from
 * `user.public_metadata.role` configured in Clerk's JWT template.
 */

import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { env } from '@/lib/env';

interface AuthProviderProps {
  children: ReactNode;
}

function ClerkNotConfigured() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">
          ⚠️ Clerk no configurado
        </h1>
        <p className="text-muted-foreground mb-4">
          Configura la variable de entorno para iniciar sesión.
        </p>
        <div className="bg-muted p-4 rounded-lg text-left text-sm font-mono">
          <code className="block bg-background p-2 rounded">
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
          </code>
        </div>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  if (!env.clerkPublishableKey) {
    return <ClerkNotConfigured />;
  }

  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
