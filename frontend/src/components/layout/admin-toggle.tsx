"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/use-auth";

interface AdminToggleProps {
  className?: string;
}

/**
 * Admin/App Toggle Button
 *
 * Only visible to Master users.
 * - In non-admin routes: Shows "Admin" button to go to /admin
 * - In /admin/* routes: Shows "App" button to go to /companies
 */
export function AdminToggle({ className }: AdminToggleProps) {
  const pathname = usePathname();
  const { isMaster, isLoading } = useUserRole();

  // Only show for master users
  if (isLoading || !isMaster) {
    return null;
  }

  const isInAdmin = pathname.startsWith("/admin");
  const targetPath = isInAdmin ? "/companies" : "/admin";
  const Icon = isInAdmin ? LayoutDashboard : Shield;
  const label = isInAdmin ? "Ir a App" : "Admin Panel";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild className={className}>
            <Link href={targetPath}>
              <Icon className="h-5 w-5" />
              <span className="sr-only">{label}</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
