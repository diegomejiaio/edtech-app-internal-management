"use client";

/**
 * Organization Selection Page
 *
 * Shown when user is authenticated but hasn't selected an organization.
 * Uses Clerk's OrganizationList component to show available orgs.
 *
 * - DEV_MODE=true: Redirects directly to /companies (uses default dev tenant)
 * - DEV_MODE=false: Shows Clerk's organization picker
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { DEV_MODE, DEV_DEFAULTS, env } from "@/lib/env";

/**
 * Dev Mode Organization Selection
 * In dev mode, we auto-redirect to /companies with default tenant
 */
function DevSelectOrg() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to app in dev mode
    router.push("/companies");
  }, [router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Logo className="h-10 w-auto" />
        </div>
        <CardTitle>Modo Desarrollo</CardTitle>
        <CardDescription>
          Redirigiendo al app con tenant: {DEV_DEFAULTS.tenantId}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </CardContent>
    </Card>
  );
}

/**
 * Production Organization Selection
 * Uses Clerk's OrganizationList component
 */
function ClerkSelectOrg() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [OrganizationListComponent, setOrganizationListComponent] =
    useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!env.clerkPublishableKey) {
      setError("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY no está configurado");
      return;
    }

    import("@clerk/clerk-react")
      .then((clerk) => {
        setOrganizationListComponent(() => clerk.OrganizationList);
      })
      .catch((err) => {
        console.error("Error loading Clerk:", err);
        setError("Error al cargar Clerk");
      });
  }, []);

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-destructive">
            Error de Configuración
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/sign-in")} className="w-full">
            Volver a Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!OrganizationListComponent) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Logo className="h-10 w-auto mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Selecciona tu Estudio</h1>
        <p className="text-muted-foreground mt-2">
          Elige el estudio contable con el que quieres trabajar
        </p>
      </div>

      <OrganizationListComponent
        hidePersonal
        afterSelectOrganizationUrl="/companies"
        afterCreateOrganizationUrl="/companies"
        appearance={{
          elements: {
            card: "shadow-none border rounded-lg",
            organizationPreview: "p-4",
          },
        }}
      />
    </div>
  );
}

export default function SelectOrgPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {DEV_MODE ? <DevSelectOrg /> : <ClerkSelectOrg />}
    </div>
  );
}
