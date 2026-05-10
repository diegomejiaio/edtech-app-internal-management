"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useRemoveUser } from "@/hooks/use-users";
import type { UserResponse } from "@/types";

interface RemoveUserDialogProps {
  user: UserResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If true, disables removal because this is the last admin */
  isLastAdmin?: boolean;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  member: "Miembro",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
};

export function RemoveUserDialog({
  user,
  open,
  onOpenChange,
  isLastAdmin = false,
}: RemoveUserDialogProps) {
  const removeUser = useRemoveUser();

  const handleRemove = () => {
    if (!user) return;

    // Use email as identifier for API since user_id might be null for pending users
    const identifier = user.user_id || user.email;

    removeUser.mutate(identifier, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      removeUser.reset();
    }
    onOpenChange(newOpen);
  };

  if (!user) return null;

  const isPending = user.status === "pending";

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {isPending ? "¿Cancelar invitación?" : "¿Eliminar usuario?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {isPending
                  ? "Estás a punto de cancelar la invitación de:"
                  : "Estás a punto de eliminar del estudio a:"}
              </p>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <p className="font-medium text-foreground">{user.email}</p>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {roleLabels[user.role] || user.role}
                  </Badge>
                  <Badge
                    variant={user.status === "active" ? "default" : "secondary"}
                  >
                    {statusLabels[user.status] || user.status}
                  </Badge>
                </div>
              </div>

              {isLastAdmin ? (
                <p className="text-destructive font-medium">
                  No puedes eliminar al único administrador activo del estudio.
                  Primero asigna el rol de administrador a otro usuario.
                </p>
              ) : (
                <p className="text-destructive">
                  {isPending
                    ? "La invitación será revocada y el usuario ya no podrá unirse al estudio con este enlace."
                    : "El usuario perderá acceso al estudio y a todas las empresas asignadas. Esta acción no se puede deshacer."}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {removeUser.isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {removeUser.error instanceof Error
                ? removeUser.error.message
                : "Error al eliminar el usuario"}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeUser.isPending}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removeUser.isPending || isLastAdmin}
          >
            {removeUser.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isPending ? "Revocando..." : "Eliminando..."}
              </>
            ) : isPending ? (
              "Sí, revocar invitación"
            ) : (
              "Sí, eliminar usuario"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
