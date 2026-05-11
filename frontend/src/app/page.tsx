"use client";

/**
 * Root gate for Espacio Pro.
 *
 * Routes the user based on Clerk auth state:
 *   - Loading    → spinner
 *   - Signed in  → /dashboard
 *   - Signed out → /sign-in
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/clerk-react";

const SIGNED_IN_HOME = "/dashboard";
const SIGNED_OUT_HOME = "/sign-in";

export default function RootGatePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    router.replace(isSignedIn ? SIGNED_IN_HOME : SIGNED_OUT_HOME);
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  );
}
