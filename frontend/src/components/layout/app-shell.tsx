'use client';

/**
 * App sidebar navigation for Espacio Pro v1.
 *
 * Sidebar morphology: collapsible icon sidebar,
 * SidebarRail, header with logo, flat nav items, settings in footer.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Users,
  User,
  Calendar,
  ClipboardList,
  CreditCard,
  Wallet,
  Receipt,
  Settings,
  HandCoins,
  MessageSquare,
  KanbanSquare,
  Workflow,
  Library,
  BarChart3,
  Bot,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Horarios', href: '/schedules', icon: Calendar },
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Profesores', href: '/teachers', icon: User },
  { label: 'Inscripciones', href: '/enrollments', icon: ClipboardList },
  { label: 'Pagos alumnos', href: '/student-payments', icon: CreditCard },
];

const CRM_NAV: NavItem[] = [
  { label: 'Mensajes', href: '/crm/inbox', icon: MessageSquare },
  { label: 'Explorer', href: '/crm/explorer', icon: KanbanSquare },
  { label: 'Flujos', href: '/crm/flows', icon: Workflow },
  { label: 'Reutilizables', href: '/crm/library', icon: Library },
  { label: 'Métricas', href: '/crm/metrics', icon: BarChart3 },
  { label: 'Agentes', href: '/crm/agents', icon: Bot },
  { label: 'Ajustes', href: '/crm/settings', icon: Settings },
];

const FINANCE_NAV: NavItem[] = [
  { label: 'Pagos profesores', href: '/teacher-payments', icon: Wallet },
  { label: 'Cobranzas', href: '/collections', icon: HandCoins },
  { label: 'Gastos', href: '/expenses', icon: Receipt },
];

const SETTINGS_ITEM: NavItem = {
  label: 'Catálogos',
  href: '/catalogs',
  icon: Settings,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const displayName =
    user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || 'Usuario';
  const email = user?.primaryEmailAddress?.emailAddress;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard">
                  <Logo variant="icon" className="size-8 shrink-0" />
                  <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                    <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
                      Espacio Pro
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Gestión de academia
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>CRM</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CRM_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Finanzas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FINANCE_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(SETTINGS_ITEM.href)}
              tooltip={SETTINGS_ITEM.label}
            >
              <Link href={SETTINGS_ITEM.href}>
                <SETTINGS_ITEM.icon />
                <span>{SETTINGS_ITEM.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="-mx-2 h-px bg-sidebar-border" />
        <div className="flex items-center gap-2 px-1.5 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: 'h-7 w-7' } }}
          />
          <div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {email ? (
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            ) : null}
          </div>
          <span className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
