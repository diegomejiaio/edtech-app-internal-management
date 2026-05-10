"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Inbox,
  FileText,
  Settings,
  Building2,
  Mail,
  LayoutDashboard,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useUserRole } from "@/hooks/use-auth";
import { useCurrentTenant } from "@/hooks/use-tenants";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useToolsSidebar } from "@/providers/tools-sidebar-store";
import { TOOLS } from "@/components/tools-sidebar";
import { useAssistantAvailable } from "@/providers/copilotkit-provider";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  /** If set, only show for these roles */
  roles?: ("admin" | "master")[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "master"],
  },
  { label: "Notificaciones", href: "/notifications", icon: Inbox },
  { label: "Empresas", href: "/companies", icon: Building2 },
  { label: "Comprobantes", href: "/comprobantes", icon: FileText },
  { label: "Comunicaciones", href: "/communications/email", icon: Mail },
];

const SETTINGS_ITEM: NavItem = {
  label: "Configuración",
  href: "/settings",
  icon: Settings,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useUserRole();
  const { data: currentTenant } = useCurrentTenant();

  const isActive = (href: string) =>
    href === "/companies"
      ? pathname === "/companies"
      : pathname === href || pathname.startsWith(href + "/");

  // Filter items by role
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.roles || (role && item.roles.includes(role as "admin" | "master")),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/companies">
                <Logo
                  variant="icon"
                  className="h-6 w-6"
                  tenantLogoUrl={currentTenant?.logo_url}
                  tenantName={currentTenant?.name}
                />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Clearbook</span>
                  <span className="text-xs text-muted-foreground">
                    Plataforma para contadores
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
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
        {/* Tools section — master only */}
        {role === "master" && <ToolsSection />}

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

// ─── Tools section ────────────────────────────────────────────────────────────

function ToolsSection() {
  const { activeTool, openTool, closeTool } = useToolsSidebar();
  const assistantEnabled = process.env.NEXT_PUBLIC_ASSISTANT_ENABLED === "true";
  const assistantAvailable = useAssistantAvailable();

  // If the chat panel is open but the assistant becomes unavailable, close it
  useEffect(() => {
    if (activeTool === "chat" && (!assistantEnabled || !assistantAvailable)) {
      closeTool();
    }
  }, [assistantAvailable, assistantEnabled, activeTool, closeTool]);

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            // Disable chat when: feature flag is off OR assistant health check failed
            const isDisabled =
              !tool.available ||
              (tool.id === "chat" &&
                (!assistantEnabled || !assistantAvailable));
            return (
              <SidebarMenuItem key={tool.id}>
                <SidebarMenuButton
                  tooltip={tool.label}
                  isActive={isActive}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    isActive ? closeTool() : openTool(tool.id);
                  }}
                >
                  <Icon />
                  <span>{tool.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
