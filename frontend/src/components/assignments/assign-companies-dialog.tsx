"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Building2, Search, CheckCircle2, Circle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAssignCompanies } from "@/hooks/use-users";
import { useInfiniteCompanies } from "@/hooks/use-companies";
import { cn } from "@/lib/utils";
import { getMemberInitials, getMemberDisplayName } from "@/lib/user-utils";
import type { UserResponse, Company } from "@/types";

interface AssignCompaniesDialogProps {
  member: UserResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignCompaniesDialog({
  member,
  open,
  onOpenChange,
}: AssignCompaniesDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const assignCompanies = useAssignCompanies();

  // Fetch companies with infinite scroll and search
  const {
    data: companiesData,
    isLoading: companiesLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteCompanies({
    is_active: true,
    limit: 50,
    search: debouncedSearch || undefined,
  });

  // Flatten all pages into single array
  const companies = useMemo(() => {
    if (!companiesData?.pages) return [];
    return companiesData.pages.flatMap((page) => page.items);
  }, [companiesData]);

  // Get total count from first page
  const totalCount = companiesData?.pages?.[0]?.total_count ?? 0;

  // Debounce search input (400ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset state when member changes or dialog opens
  useEffect(() => {
    if (member && open) {
      setSelectedIds(new Set(member.assigned_company_ids || []));
      setSearch("");
      setDebouncedSearch("");
    }
  }, [member, open]);

  const toggleCompany = useCallback((companyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    // Select all currently loaded companies
    setSelectedIds(new Set(companies.map((c) => c.id)));
  }, [companies]);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSubmit = async () => {
    if (!member) return;

    const userId = member.user_id || member.email;
    await assignCompanies.assignAsync(userId, Array.from(selectedIds));
    onOpenChange(false);
  };

  const handleClose = () => {
    assignCompanies.reset();
    setSearch("");
    setDebouncedSearch("");
    onOpenChange(false);
  };

  if (!member) return null;

  const originalIds = new Set(member.assigned_company_ids || []);
  const hasChanges =
    selectedIds.size !== originalIds.size ||
    ![...selectedIds].every((id) => originalIds.has(id));

  const isSearching = search !== debouncedSearch;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getMemberInitials(member)}
              </AvatarFallback>
            </Avatar>
            <div>
              <span>Asignar Empresas</span>
              <p className="text-sm font-normal text-muted-foreground">
                {getMemberDisplayName(member)}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Selecciona las empresas a las que este miembro tendra acceso.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa por nombre o RUC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="font-normal">
            {selectedIds.size} de {totalCount} seleccionadas
          </Badge>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={
                selectedIds.size === companies.length || companiesLoading
              }
              className="h-7 text-xs"
            >
              Seleccionar todas
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={selectedIds.size === 0}
              className="h-7 text-xs"
            >
              Limpiar
            </Button>
          </div>
        </div>

        {/* Companies List - styled scrollbar */}
        <div className="h-[300px] overflow-y-auto rounded-md border p-2 space-y-1 custom-scrollbar">
          {companiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {search
                  ? "No se encontraron empresas con ese criterio"
                  : "No hay empresas disponibles"}
              </p>
            </div>
          ) : (
            <>
              {companies.map((company) => {
                const isSelected = selectedIds.has(company.id);
                const wasOriginallySelected = originalIds.has(company.id);

                return (
                  <div
                    key={company.id}
                    onClick={() => toggleCompany(company.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/5 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleCompany(company.id)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {company.business_name}
                        </span>
                        {isSelected && !wasOriginallySelected && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-green-600 border-green-300"
                          >
                            Nueva
                          </Badge>
                        )}
                        {!isSelected && wasOriginallySelected && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-red-600 border-red-300"
                          >
                            Remover
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        RUC: {company.ruc}
                      </p>
                    </div>

                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                  </div>
                );
              })}

              {/* Load more button */}
              {hasNextPage && !search && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full h-8 text-xs"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      `Ver mas (${companies.length} de ${totalCount})`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {assignCompanies.isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {assignCompanies.error instanceof Error
                ? assignCompanies.error.message
                : "Error al actualizar las asignaciones"}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={assignCompanies.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={assignCompanies.isPending || !hasChanges}
          >
            {assignCompanies.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
