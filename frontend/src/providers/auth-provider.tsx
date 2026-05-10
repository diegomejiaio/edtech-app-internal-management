"use client";

/**
 * Authentication Provider
 *
 * Strategy:
 * - DEV_MODE=true: Mock auth, no Clerk dependency
 * - DEV_MODE=false: Full Clerk integration
 *
 * Uses dynamic import to completely avoid loading Clerk in DEV_MODE.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { DEV_MODE, DEV_DEFAULTS, env } from "@/lib/env";

/**
 * Auth state interface
 */
export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
  role: "master" | "admin" | "member" | null;
  has: ((params: { permission: string }) => boolean) | null;
  getToken: () => Promise<string | null>;
}

/**
 * Mock auth state for DEV_MODE
 */
const DEV_AUTH_STATE: AuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: DEV_DEFAULTS.userId,
  orgId: DEV_DEFAULTS.tenantId,
  orgRole: "org:master",
  role: DEV_DEFAULTS.userRole as "master" | "admin" | "member",
  has: () => true, // All permissions in dev mode
  getToken: async () => "dev-mock-token",
};

/**
 * Initial loading state
 */
const LOADING_AUTH_STATE: AuthState = {
  isLoaded: false,
  isSignedIn: false,
  userId: null,
  orgId: null,
  orgRole: null,
  role: null,
  has: null,
  getToken: async () => null,
};

/**
 * Auth context
 */
const AuthContext = createContext<AuthState>(LOADING_AUTH_STATE);

/**
 * Hook to get auth state from context
 */
export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Error component shown when Clerk is not configured
 */
function ClerkNotConfigured() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">
          ⚠️ Clerk No Configurado
        </h1>
        <p className="text-muted-foreground mb-4">
          La autenticación requiere Clerk pero no está configurado.
        </p>
        <div className="bg-muted p-4 rounded-lg text-left text-sm font-mono">
          <p className="text-muted-foreground mb-2">Opciones:</p>
          <p className="mb-2">1. Habilitar DEV_MODE:</p>
          <code className="block bg-background p-2 rounded mb-2">
            NEXT_PUBLIC_DEV_MODE=true
          </code>
          <p className="mb-2">2. Configurar Clerk:</p>
          <code className="block bg-background p-2 rounded">
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
          </code>
        </div>
      </div>
    </div>
  );
}

/**
 * Dev mode provider with mock auth
 */
function DevAuthProvider({ children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={DEV_AUTH_STATE}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Production auth provider - dynamically loads Clerk
 */
function ProductionAuthProvider({ children }: AuthProviderProps) {
  const [ClerkModule, setClerkModule] = useState<
    typeof import("@clerk/clerk-react") | null
  >(null);

  // Dynamically import Clerk only in production
  useEffect(() => {
    import("@clerk/clerk-react").then(setClerkModule);
  }, []);

  // While Clerk loads, render children with loading auth state
  // This allows public pages (landing, etc.) to render immediately
  // Protected pages have their own loading states
  if (!ClerkModule) {
    return (
      <AuthContext.Provider value={LOADING_AUTH_STATE}>
        {children}
      </AuthContext.Provider>
    );
  }

  const { ClerkProvider } = ClerkModule;

  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/companies"
      signUpFallbackRedirectUrl="/companies"
      afterSignOutUrl="/sign-in"
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
        },
      }}
    >
      <ClerkAuthBridge ClerkModule={ClerkModule}>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

/**
 * Bridge component that uses Clerk's useAuth inside the provider
 */
function ClerkAuthBridge({
  children,
  ClerkModule,
}: {
  children: ReactNode;
  ClerkModule: typeof import("@clerk/clerk-react");
}) {
  const clerkAuth = ClerkModule.useAuth();

  // Parse org role to our role format
  const parseRole = (
    orgRole: string | null | undefined,
  ): "master" | "admin" | "member" | null => {
    if (!orgRole) return null;
    const role = orgRole.replace("org:", "");
    if (role === "master" || role === "admin" || role === "member") {
      return role;
    }
    return "member"; // Default to member for unknown roles
  };

  const authState: AuthState = {
    isLoaded: clerkAuth.isLoaded,
    isSignedIn: clerkAuth.isSignedIn ?? false,
    userId: clerkAuth.userId ?? null,
    orgId: clerkAuth.orgId ?? null,
    orgRole: clerkAuth.orgRole ?? null,
    role: parseRole(clerkAuth.orgRole),
    has: clerkAuth.has ?? null,
    getToken: clerkAuth.getToken,
  };

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
}

/**
 * Main AuthProvider - chooses strategy based on DEV_MODE
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // DEV_MODE - no Clerk needed
  if (DEV_MODE) {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }

  // Production - require Clerk key
  if (!env.clerkPublishableKey) {
    console.error(
      "❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required when DEV_MODE is false",
    );
    return <ClerkNotConfigured />;
  }

  return <ProductionAuthProvider>{children}</ProductionAuthProvider>;
}
