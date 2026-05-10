"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-auth";
import { FadeIn } from "@/components/motion";

interface SettingsLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Settings;
  requiresAdmin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "General",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "Usuarios",
    href: "/settings/users",
    icon: Users,
    requiresAdmin: true,
  },
  {
    label: "Asignaciones",
    href: "/settings/assignments",
    icon: Link2,
    requiresAdmin: true,
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const { canManageTenant, isLoading } = useUserRole();

  // Filter nav items based on permissions
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiresAdmin || canManageTenant,
  );

  const isActive = (href: string) => {
    if (href === "/settings") {
      return pathname === "/settings";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="space-y-6">
      {/* Settings Header with Navigation */}
      <FadeIn>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Configuración
            </h1>
            <p className="text-muted-foreground">
              Administra la configuración de tu estudio contable
            </p>
          </div>

          {/* Navigation Tabs */}
          {!isLoading && visibleItems.length > 1 && (
            <nav
              className="flex gap-1 border-b"
              role="tablist"
              aria-label="Secciones de configuración"
            >
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="tab"
                  aria-selected={isActive(item.href)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive(item.href)
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </FadeIn>

      {/* Settings Content */}
      <div>{children}</div>
    </div>
  );
}
