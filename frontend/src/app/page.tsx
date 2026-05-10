"use client";

/**
 * Root gate for app.clear-book.com.
 *
 * The marketing landing lives on clear-book.com (Astro project at `landing/`).
 * This page just routes the user based on auth state:
 *   - Loading      → spinner
 *   - Signed in    → /companies
 *   - Signed out   → /sign-in
 *
 * Static export friendly: pure client redirect, no SSR needed.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/providers/auth-provider";
import { DEV_MODE } from "@/lib/env";

const SIGNED_IN_HOME = "/companies";
const SIGNED_OUT_HOME = "/sign-in";

export default function RootGatePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuthContext();

  useEffect(() => {
    if (DEV_MODE) {
      router.replace(SIGNED_IN_HOME);
      return;
    }
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
