"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Link2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Users,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FadeIn } from "@/components/motion";
import { AssignmentGrid } from "@/components/assignments/assignment-grid";
import { AssignCompaniesDialog } from "@/components/assignments/assign-companies-dialog";
import { useUsers } from "@/hooks/use-users";
import { useCompanies } from "@/hooks/use-companies";
import { useUserRole } from "@/hooks/use-auth";
import type { UserResponse } from "@/types";

export default function AssignmentsSettingsPage() {
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useUsers();
  const {
    data: companiesData,
    isLoading: companiesLoading,
    error: companiesError,
  } = useCompanies({
    is_active: true,
    limit: 500, // Load all companies for accurate counts and export
  });
  const { canManageTenant } = useUserRole();

  // Lift dialog state to page level for proper portal isolation
  const [editingMember, setEditingMember] = useState<UserResponse | null>(null);

  const isLoading = usersLoading || companiesLoading;
  const error = usersError || companiesError;

  const users = usersData?.items ?? [];
  const companies = companiesData?.items ?? [];

  // Filter to only show members (admins have access to all)
  const members = useMemo(
    () => users.filter((user) => user.role === "member"),
    [users],
  );

  // Calculate stats (only counts, not full arrays)
  const stats = useMemo(() => {
    const allAssignedCompanyIds = new Set(
      members.flatMap((m) => m.assigned_company_ids || []),
    );

    const unassignedCount = companies.filter(
      (c) => !allAssignedCompanyIds.has(c.id),
    ).length;

    const membersWithNoCompaniesCount = members.filter(
      (m) => !m.assigned_company_ids || m.assigned_company_ids.length === 0,
    ).length;

    const totalAssignments = members.reduce(
      (sum, m) => sum + (m.assigned_company_ids?.length || 0),
      0,
    );
    const avgCompaniesPerMember =
      members.length > 0 ? totalAssignments / members.length : 0;

    return {
      totalMembers: members.length,
      totalCompanies: companies.length,
      unassignedCount,
      membersWithNoCompaniesCount,
      avgCompaniesPerMember: Math.round(avgCompaniesPerMember * 10) / 10,
      coveragePercent:
        companies.length > 0
          ? Math.round(
              ((companies.length - unassignedCount) / companies.length) * 100,
            )
          : 0,
    };
  }, [members, companies]);

  // Download assignments as CSV (Excel-compatible)
  const downloadExcel = useCallback(() => {
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const rows: string[][] = [["Usuario (correo)", "Rol", "Empresa (razón social)", "Empresa (RUC)"]];

    members.forEach((member) => {
      const role = member.role === "member" ? "Miembro" : member.role === "admin" ? "Admin" : member.role;
      (member.assigned_company_ids || []).forEach((companyId) => {
        const company = companyMap.get(companyId);
        rows.push([
          member.email,
          role,
          company?.business_name ?? "No encontrada",
          company?.ruc ?? "-",
        ]);
      });
    });

    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asignaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [members, companies]);

  // Non-admin users cannot access this page
  if (!canManageTenant) {
    return (
      <FadeIn>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Solo los administradores pueden gestionar las asignaciones de
            empresas. Contacta a tu administrador si necesitas acceso.
          </AlertDescription>
        </Alert>
      </FadeIn>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : "No se pudo cargar la informacion"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Miembros
              </CardDescription>
              <CardTitle className="text-3xl">{stats.totalMembers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {stats.avgCompaniesPerMember} empresas promedio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Empresas Activas
              </CardDescription>
              <CardTitle className="text-3xl">{stats.totalCompanies}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {stats.coveragePercent}% con asignacion
              </p>
            </CardContent>
          </Card>

          <Card
            className={stats.unassignedCount > 0 ? "border-amber-500/50" : ""}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                {stats.unassignedCount > 0 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                Sin Asignar
              </CardDescription>
              <CardTitle
                className={`text-3xl ${stats.unassignedCount > 0 ? "text-amber-500" : ""}`}
              >
                {stats.unassignedCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                empresas sin miembro asignado
              </p>
            </CardContent>
          </Card>

          <Card
            className={
              stats.membersWithNoCompaniesCount > 0 ? "border-amber-500/50" : ""
            }
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                {stats.membersWithNoCompaniesCount > 0 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                Miembros Inactivos
              </CardDescription>
              <CardTitle
                className={`text-3xl ${stats.membersWithNoCompaniesCount > 0 ? "text-amber-500" : ""}`}
              >
                {stats.membersWithNoCompaniesCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                sin empresas asignadas
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Assignment Grid */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Asignaciones de Empresas
              </CardTitle>
              <CardDescription>
                Asigna empresas a los miembros del equipo. Los administradores
                tienen acceso a todas las empresas automaticamente.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadExcel}
              disabled={members.length === 0}
              aria-label="Descargar asignaciones en Excel"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Exportar
            </Button>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No hay miembros</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Los miembros son usuarios con acceso limitado a empresas
                  especificas. Invita usuarios con rol &quot;Miembro&quot; para
                  gestionar sus asignaciones aqui.
                </p>
              </div>
            ) : companies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No hay empresas</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Agrega empresas a tu estudio para poder asignarlas a los
                  miembros del equipo.
                </p>
              </div>
            ) : (
              <AssignmentGrid
                members={members}
                companies={companies}
                onEditMember={setEditingMember}
              />
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Dialog rendered at page level for proper z-index isolation */}
      <AssignCompaniesDialog
        member={editingMember}
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
      />
    </div>
  );
}
