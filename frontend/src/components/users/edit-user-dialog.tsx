"use client";

import { useState, useEffect } from "react";
import { Loader2, UserCog, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateUser } from "@/hooks/use-users";
import { useCompanies } from "@/hooks/use-companies";
import type { UserResponse } from "@/types";

interface EditUserDialogProps {
  user: UserResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDemote: boolean; // false if last admin
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  canDemote,
}: EditUserDialogProps) {
  const [role, setRole] = useState<"admin" | "member">("member");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  const updateUser = useUpdateUser();
  const { data: companiesData, isLoading: companiesLoading } = useCompanies({
    is_active: true,
    limit: 100,
  });
  const companies = companiesData?.items || [];

  // Initialize form when user changes
  useEffect(() => {
    if (user) {
      setRole(user.role);
      setSelectedCompanyIds(user.assigned_company_ids || []);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Use user_id if active, otherwise use email as identifier
    const userId = user.user_id || user.email;

    updateUser.mutate(
      {
        userId,
        data: {
          role,
          // Only include company_ids if member role (FR-012)
          assigned_company_ids: role === "member" ? selectedCompanyIds : [],
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      updateUser.reset();
    }
    onOpenChange(newOpen);
  };

  const handleRoleChange = (newRole: "admin" | "member") => {
    setRole(newRole);
    // If promoting to admin, clear company assignments (FR-012)
    if (newRole === "admin") {
      setSelectedCompanyIds([]);
    }
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  const selectAllCompanies = () => {
    setSelectedCompanyIds(companies.map((c) => c.id));
  };

  const clearAllCompanies = () => {
    setSelectedCompanyIds([]);
  };

  if (!user) return null;

  const hasChanges =
    role !== user.role ||
    JSON.stringify(selectedCompanyIds.sort()) !==
      JSON.stringify((user.assigned_company_ids || []).sort());

  const showDemoteWarning =
    user.role === "admin" && role === "member" && !canDemote;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Editar Usuario
          </DialogTitle>
          <DialogDescription>
            Modifica el rol y permisos del usuario{" "}
            <span className="font-medium">{user.email}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Select */}
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                handleRoleChange(value as "admin" | "member")
              }
              disabled={showDemoteWarning}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Administrador</span>
                    <span className="text-xs text-muted-foreground">
                      Acceso total a todas las empresas
                    </span>
                  </div>
                </SelectItem>
                <SelectItem
                  value="member"
                  disabled={user.role === "admin" && !canDemote}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Miembro</span>
                    <span className="text-xs text-muted-foreground">
                      Acceso limitado a empresas asignadas
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Warning if can't demote last admin */}
          {showDemoteWarning && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No puedes cambiar el rol de este usuario porque es el único
                administrador activo del estudio.
              </AlertDescription>
            </Alert>
          )}

          {/* Company Assignment (only for members) */}
          {role === "member" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Empresas Asignadas</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllCompanies}
                    disabled={companiesLoading || companies.length === 0}
                    className="h-7 text-xs"
                  >
                    Seleccionar todas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllCompanies}
                    disabled={selectedCompanyIds.length === 0}
                    className="h-7 text-xs"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              {companiesLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : companies.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No hay empresas disponibles para asignar
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[200px] rounded-md border p-2">
                  <div className="space-y-2">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center space-x-2 rounded-md p-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          id={company.id}
                          checked={selectedCompanyIds.includes(company.id)}
                          onCheckedChange={() => toggleCompany(company.id)}
                        />
                        <label
                          htmlFor={company.id}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <span className="font-medium">
                            {company.business_name}
                          </span>
                          <span className="ml-2 text-muted-foreground font-mono text-xs">
                            {company.ruc}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedCompanyIds.length} de {companies.length} empresas
                seleccionadas
              </p>
            </div>
          )}

          {/* Info message for admins */}
          {role === "admin" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Los administradores tienen acceso automático a todas las
                empresas del estudio.
              </AlertDescription>
            </Alert>
          )}

          {updateUser.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                {updateUser.error instanceof Error
                  ? updateUser.error.message
                  : "Error al actualizar el usuario"}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={updateUser.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                updateUser.isPending || !hasChanges || showDemoteWarning
              }
            >
              {updateUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
