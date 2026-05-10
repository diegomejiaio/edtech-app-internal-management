"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  TenantSwitcher,
  AdminToggle,
  AppSidebar,
  TodayExchangeRate,
} from "@/components/layout";
import { ClientOnly } from "@/components/client-only";
import { ToolsSidebar } from "@/components/tools-sidebar";
import { ToolsSidebarProvider } from "@/providers/tools-sidebar-store";
import { CopilotKitProvider } from "@/providers/copilotkit-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthState } from "@/hooks/use-auth";
import { useCurrentTenant } from "@/hooks/use-tenants";
import { useVersionCheck } from "@/hooks/use-version-check";
import { DEV_MODE, DEV_DEFAULTS } from "@/lib/env";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const auth = useAuthState();
  useVersionCheck();

  // Validate tenant exists in backend (not just in Clerk)
  const {
    data: tenant,
    isLoading: isTenantLoading,
    error: tenantError,
  } = useCurrentTenant();

  // Redirect to sign-in if not authenticated (only when DEV_MODE is false)
  useEffect(() => {
    if (!DEV_MODE && auth.isLoaded && !auth.isSignedIn) {
      router.replace("/sign-in");
    }
  }, [auth.isLoaded, auth.isSignedIn, router]);

  // Redirect to waiting page if:
  // 1. User has no Clerk organization, OR
  // 2. User's Clerk org is not linked to a tenant in our database
  useEffect(() => {
    if (DEV_MODE) return;

    if (!auth.isLoaded || !auth.isSignedIn) return;

    // Case 1: No Clerk organization at all
    if (!auth.orgId) {
      router.replace("/waiting");
      return;
    }

    // Case 2: Has Clerk org but tenant lookup failed (403 = not linked, 404 = not found)
    if (tenantError) {
      console.log(
        "[DashboardLayout] Tenant error, redirecting to waiting:",
        tenantError,
      );
      router.replace("/waiting");
      return;
    }
  }, [auth.isLoaded, auth.isSignedIn, auth.orgId, tenantError, router]);

  // Show loading while checking auth (only in production mode)
  if (!DEV_MODE && !auth.isLoaded) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  // Block render if not signed in (production mode only)
  if (!DEV_MODE && !auth.isSignedIn) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <div className="text-muted-foreground text-sm">Redirigiendo...</div>
      </div>
    );
  }

  // Block render if no organization (production mode only)
  if (!DEV_MODE && !auth.orgId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <div className="text-muted-foreground text-sm">
          Verificando organización...
        </div>
      </div>
    );
  }

  // Block render while validating tenant in backend (production mode only)
  if (!DEV_MODE && isTenantLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <div className="text-muted-foreground text-sm">Validando cuenta...</div>
      </div>
    );
  }

  // Block render if tenant validation failed (will redirect via useEffect)
  if (!DEV_MODE && tenantError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <div className="text-muted-foreground text-sm">
          Verificando permisos...
        </div>
      </div>
    );
  }

  return (
    <ClientOnly
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <CopilotKitProvider>
        <ToolsSidebarProvider>
          {/* Left navigation sidebar */}
          <SidebarProvider defaultOpen={false}>
            <AppSidebar />
            <AppLayout role={auth.role}>{children}</AppLayout>
          </SidebarProvider>
        </ToolsSidebarProvider>
      </CopilotKitProvider>
    </ClientOnly>
  );
}

/**
 * Renders DevUserBadge in DEV_MODE, ClerkUserButton in production.
 */
function ClerkOrDevUserButton() {
  return DEV_MODE ? <DevUserBadge /> : <ClerkUserButton />;
}

/**
 * App layout — sits inside the left SidebarProvider.
 * Reads toggleSidebar for the left sidebar trigger.
 * ToolsSidebar is a plain <aside> sibling to SidebarInset — no extra SidebarProvider needed.
 */
interface AppLayoutProps {
  children: ReactNode;
  role: string | null | undefined;
}

function AppLayout({ children, role }: AppLayoutProps) {
  const { toggleSidebar: toggleLeftSidebar } = useSidebar();

  return (
    <>
      <SidebarInset className="min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          {/* Left side - Left sidebar trigger + Tenant Switcher */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 -ml-1"
              onClick={toggleLeftSidebar}
              aria-label="Toggle navigation sidebar"
            >
              <PanelLeftIcon />
              <span className="sr-only">Abrir navegación</span>
            </Button>
            <Separator orientation="vertical" className="mr-2 h-4" />
            <TenantSwitcher />
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <TodayExchangeRate />
            <AdminToggle />
            <ThemeToggle />
            <ClerkOrDevUserButton />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>

      {role === "master" && <ToolsSidebar />}
    </>
  );
}

/**
 * Dev Mode User Badge - shown instead of Clerk's UserButton
 */
function DevUserBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium cursor-default">
            🔧
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs">
            <p className="font-medium">{DEV_DEFAULTS.userName}</p>
            <p className="text-muted-foreground">{DEV_DEFAULTS.userEmail}</p>
            <p className="text-muted-foreground">
              Rol: {DEV_DEFAULTS.userRole}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Clerk UserButton - dynamically loaded
 */
function ClerkUserButton() {
  const [UserButton, setUserButton] = useState<React.ComponentType<{
    afterSignOutUrl?: string;
    appearance?: object;
  }> | null>(null);

  useEffect(() => {
    import("@clerk/clerk-react").then((clerk) => {
      setUserButton(() => clerk.UserButton);
    });
  }, []);

  if (!UserButton) {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;
  }

  return (
    <UserButton
      afterSignOutUrl="/sign-in"
      appearance={{
        elements: {
          avatarBox: "h-8 w-8",
        },
      }}
    />
  );
}
