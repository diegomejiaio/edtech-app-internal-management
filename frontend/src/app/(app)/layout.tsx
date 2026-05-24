'use client';

import type { ReactNode } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { PanelLeftIcon } from 'lucide-react';
import { AuthGate } from '@/components/auth';
import { AppSidebar } from '@/components/layout';
import { ErrorBoundary } from '@/components/data';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/**
 * App segment layout — Espacio Pro morphology:
 * AuthGate → SidebarProvider → AppSidebar + SidebarInset(header + main).
 *
 * The header is a slim toolbar (sidebar trigger, theme toggle, user button).
 * Each page owns its own PageHeader for title/breadcrumbs/actions.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <AppContent>{children}</AppContent>
      </SidebarProvider>
    </AuthGate>
  );
}

function AppContent({ children }: { children: ReactNode }) {
  const { toggleSidebar } = useSidebar();

  return (
    <SidebarInset className="min-w-0 overflow-hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 -ml-1"
            onClick={toggleSidebar}
            aria-label="Toggle navigation sidebar"
          >
            <PanelLeftIcon />
            <span className="sr-only">Abrir navegación</span>
          </Button>
          <Separator orientation="vertical" className="mr-2 h-4" />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </SidebarInset>
  );
}
