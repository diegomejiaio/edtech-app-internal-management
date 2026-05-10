"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Shield,
  User,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EditUserDialog } from "./edit-user-dialog";
import { RemoveUserDialog } from "./remove-user-dialog";
import type { UserResponse } from "@/types";
import { formatLocalDateLong } from "@/lib/dates";

interface UserTableProps {
  users: UserResponse[];
  isLoading?: boolean;
  adminCount: number; // Number of active admins (to prevent removing last)
}

const roleConfig = {
  admin: { label: "Administrador", variant: "default" as const, icon: Shield },
  member: { label: "Miembro", variant: "secondary" as const, icon: User },
};

const statusConfig = {
  pending: {
    label: "Invitación Pendiente",
    variant: "outline" as const,
    icon: Clock,
  },
  active: { label: "Activo", variant: "default" as const, icon: null },
};

export function UserTable({ users, isLoading, adminCount }: UserTableProps) {
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [removeUser, setRemoveUser] = useState<UserResponse | null>(null);

  if (isLoading) {
    return <UserTableSkeleton />;
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Mail className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No hay usuarios en tu estudio.
        </p>
        <p className="text-xs text-muted-foreground">
          Invita a tu equipo para comenzar a colaborar.
        </p>
      </div>
    );
  }

  // Sort: active users first, then by email
  const sortedUsers = [...users].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "active" ? -1 : 1;
    }
    return a.email.localeCompare(b.email);
  });

  // Check if user can be removed (not last active admin)
  const canRemoveUser = (user: UserResponse): boolean => {
    if (user.role !== "admin" || user.status !== "active") return true;
    return adminCount > 1;
  };

  // Check if user can be demoted (not last active admin)
  const canDemoteUser = (user: UserResponse): boolean => {
    if (user.role !== "admin" || user.status !== "active") return true;
    return adminCount > 1;
  };

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">
                Empresas Asignadas
              </TableHead>
              <TableHead className="hidden lg:table-cell">Invitado</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.map((user) => {
              const role = roleConfig[user.role];
              const status = statusConfig[user.status];
              const RoleIcon = role.icon;
              const StatusIcon = status.icon;

              return (
                <TableRow key={user.email}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <RoleIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        {user.name && (
                          <span className="font-medium">{user.name}</span>
                        )}
                        <span
                          className={
                            user.name
                              ? "text-sm text-muted-foreground"
                              : "font-medium"
                          }
                        >
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.variant} className="gap-1">
                      {role.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1">
                      {StatusIcon && <StatusIcon className="h-3 w-3" />}
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {user.role === "admin" ? (
                      <span className="text-muted-foreground text-sm">
                        Todas las empresas
                      </span>
                    ) : user.assigned_company_ids.length > 0 ? (
                      <span className="text-sm">
                        {user.assigned_company_ids.length} empresa(s)
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Sin asignar
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {formatLocalDateLong(user.invited_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Acciones</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditUser(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setRemoveUser(user)}
                          className="text-destructive focus:text-destructive"
                          disabled={!canRemoveUser(user)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {!canRemoveUser(user)
                            ? "No se puede eliminar"
                            : "Eliminar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        canDemote={editUser ? canDemoteUser(editUser) : true}
      />

      <RemoveUserDialog
        user={removeUser}
        open={!!removeUser}
        onOpenChange={(open) => !open && setRemoveUser(null)}
        isLastAdmin={removeUser ? !canRemoveUser(removeUser) : false}
      />
    </>
  );
}

function UserTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">
              Empresas Asignadas
            </TableHead>
            <TableHead className="hidden lg:table-cell">Invitado</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
