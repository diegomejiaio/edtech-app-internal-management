'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthGate } from '@/components/auth';
import { AppSidebar } from '@/components/layout';
import { ErrorBoundary } from '@/components/data';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * App segment layout — Espacio Pro morphology:
 * AuthGate → SidebarProvider → AppSidebar + SidebarInset(main).
 *
 * No top header bar: sidebar trigger, theme toggle and user button live in the
 * sidebar footer, so content uses the full viewport height. A floating trigger is
 * shown on mobile only (where the footer trigger is hidden behind the closed sheet).
 *
 * CRM routes are full-bleed app shells (their own internal scroll), so `main` drops
 * its padding/scroll there to avoid a height/width mismatch that breaks the layout.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname.startsWith('/crm');

  return (
    <AuthGate>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-hidden">
          <SidebarTrigger className="fixed left-2 top-2 z-50 border bg-background/80 backdrop-blur md:hidden" />
          <main className={cn(fullBleed ? 'h-svh overflow-hidden' : 'min-h-0 flex-1 overflow-auto p-6')}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGate>
  );
}
