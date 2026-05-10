"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminToggle, AdminSidebar } from "@/components/layout";
import { ClientOnly } from "@/components/client-only";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuthState } from "@/hooks/use-auth";
import { DEV_MODE, DEV_DEFAULTS } from "@/lib/env";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const auth = useAuthState();

  // Redirect to sign-in if not authenticated (only when DEV_MODE is false)
  useEffect(() => {
    if (!DEV_MODE && auth.isLoaded && !auth.isSignedIn) {
      router.replace("/sign-in");
    }
  }, [auth.isLoaded, auth.isSignedIn, router]);

  // Redirect non-master users out of /admin (Master-only zone).
  // Backend re-validates every admin request — this is just UX.
  useEffect(() => {
    if (DEV_MODE) return;
    if (!auth.isLoaded || !auth.isSignedIn) return;
    if (auth.role && auth.role !== "master") {
      router.replace("/companies");
    }
  }, [auth.isLoaded, auth.isSignedIn, auth.role, router]);

  // Show loading while checking auth (only in production mode)
  if (!DEV_MODE && !auth.isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  // Block render if not signed in (production mode only)
  if (!DEV_MODE && !auth.isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirigiendo...</div>
      </div>
    );
  }

  // Block render for non-master users (will redirect via useEffect)
  if (!DEV_MODE && auth.role && auth.role !== "master") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <div className="text-muted-foreground text-sm">
          Acceso restringido a administradores...
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
      <SidebarProvider defaultOpen={false}>
        <AdminSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
            {/* Left side - Sidebar Trigger + Badge */}
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Admin Panel
              </span>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
              <AdminToggle />
              <ThemeToggle />
              {DEV_MODE ? <DevUserBadge /> : <ClerkUserButton />}
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ClientOnly>
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
