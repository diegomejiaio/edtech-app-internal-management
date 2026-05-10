"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FadeIn } from "@/components/motion";
import { UserTable } from "@/components/users/user-table";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import { useUsers, useSyncUsers } from "@/hooks/use-users";
import { useUserRole } from "@/hooks/use-auth";

export default function UsersSettingsPage() {
  const { data, isLoading, error } = useUsers();
  const syncUsers = useSyncUsers();
  const { canManageTenant } = useUserRole();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Calculate active admin count for FR-011 protection
  const activeAdminCount =
    data?.items.filter(
      (user) => user.role === "admin" && user.status === "active",
    ).length ?? 0;

  // Non-admin users cannot access this page
  if (!canManageTenant) {
    return (
      <FadeIn>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Solo los administradores pueden gestionar usuarios. Contacta a tu
            administrador si necesitas acceso.
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
            : "No se pudo cargar la lista de usuarios"}
        </AlertDescription>
      </Alert>
    );
  }

  const users = data?.items ?? [];
  const totalCount = data?.total_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <FadeIn>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => syncUsers.mutate()}
            disabled={syncUsers.isPending}
          >
            {syncUsers.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar desde Clerk
              </>
            )}
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar Usuario
          </Button>
        </div>
      </FadeIn>

      {/* Stats Summary */}
      <FadeIn delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Usuarios</CardDescription>
              <CardTitle className="text-3xl">{totalCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Administradores</CardDescription>
              <CardTitle className="text-3xl">
                {users.filter((u) => u.role === "admin").length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Invitaciones Pendientes</CardDescription>
              <CardTitle className="text-3xl">
                {users.filter((u) => u.status === "pending").length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </FadeIn>

      {/* Users Table */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Usuarios
            </CardTitle>
            <CardDescription>
              {totalCount === 0
                ? "No hay usuarios registrados"
                : `${totalCount} usuario${totalCount !== 1 ? "s" : ""} en el estudio`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserTable users={users} adminCount={activeAdminCount} />
          </CardContent>
        </Card>
      </FadeIn>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
