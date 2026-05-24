'use client';

/**
 * App sidebar navigation for Espacio Pro v1.
 *
 * Sidebar morphology: collapsible icon sidebar,
 * SidebarRail, header with logo, flat nav items, settings in footer.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  ClipboardList,
  CreditCard,
  Wallet,
  Receipt,
  Settings,
  BookOpen,
  MapPin,
  HandCoins,
  Layers,
  CalendarDays,
  Megaphone,
  Banknote,
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
  SidebarSeparator,
} from '@/components/ui/sidebar';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Horarios', href: '/schedules', icon: Calendar },
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Inscripciones', href: '/enrollments', icon: ClipboardList },
  { label: 'Pagos alumnos', href: '/student-payments', icon: CreditCard },
];

const CATALOG_NAV: NavItem[] = [
  { label: 'Cursos', href: '/courses', icon: BookOpen },
  { label: 'Niveles', href: '/levels', icon: Layers },
  { label: 'Días', href: '/weekdays', icon: CalendarDays },
  { label: 'Fuentes', href: '/student-sources', icon: Megaphone },
  { label: 'Espacios', href: '/spaces', icon: MapPin },
  { label: 'Profesores', href: '/teachers', icon: GraduationCap },
];

const FINANCE_NAV: NavItem[] = [
  { label: 'Pagos profesores', href: '/teacher-payments', icon: Wallet },
  { label: 'Cobranzas', href: '/collections', icon: HandCoins },
  { label: 'Gastos', href: '/expenses', icon: Receipt },
  { label: 'Medios de pago', href: '/payment-methods', icon: Banknote },
];

const SETTINGS_ITEM: NavItem = {
  label: 'Catálogos',
  href: '/catalogs',
  icon: Settings,
};

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
                  EP
                </div>
                <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold">Espacio Pro</span>
                  <span className="text-xs text-muted-foreground">
                    Gestión de academia
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
          <SidebarGroupLabel>Catálogo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CATALOG_NAV.map((item) => (
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
        <SidebarSeparator />
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
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
