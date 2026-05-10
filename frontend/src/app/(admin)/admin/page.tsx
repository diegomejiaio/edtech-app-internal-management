"use client";

import { Building2, Users, CheckCircle, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/motion";
import { useTenants } from "@/hooks/use-tenants";

export default function AdminDashboardPage() {
  const { data: tenantsData, isLoading } = useTenants();
  const tenants = tenantsData?.items ?? [];

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === "active").length,
    pending: tenants.filter((t) => t.status === "pending").length,
    suspended: tenants.filter((t) => t.status === "suspended").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del sistema</p>
        </div>
      </FadeIn>

      {/* Stats Cards */}
      <FadeIn delay={0.1}>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Tenants
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "—" : stats.total}
              </div>
              <p className="text-xs text-muted-foreground">
                Organizaciones registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activos</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? "—" : stats.active}
              </div>
              <p className="text-xs text-muted-foreground">
                Tenants operativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {isLoading ? "—" : stats.pending}
              </div>
              <p className="text-xs text-muted-foreground">
                Esperando activación
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">Próximamente</p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Quick Actions */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Operaciones frecuentes de administración
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <a
              href="/admin/tenants"
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Gestionar Tenants</p>
                <p className="text-sm text-muted-foreground">
                  Crear, activar o suspender organizaciones
                </p>
              </div>
            </a>
            <a
              href="/admin/pending"
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Usuarios Pendientes</p>
                <p className="text-sm text-muted-foreground">
                  Asignar usuarios a organizaciones
                </p>
              </div>
            </a>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
