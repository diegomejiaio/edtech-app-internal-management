"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateCompany } from "@/hooks/use-companies";
import type { Company } from "@/types";

interface EditCompanyDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditFormProps {
  company: Company;
  onClose: () => void;
}

function EditForm({ company, onClose }: EditFormProps) {
  const [businessName, setBusinessName] = useState(company.business_name);
  const [businessNameError, setBusinessNameError] = useState("");

  const updateCompany = useUpdateCompany();

  const validate = (): boolean => {
    if (businessName.trim().length < 3) {
      setBusinessNameError("La razón social debe tener al menos 3 caracteres");
      return false;
    }
    setBusinessNameError("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    updateCompany.mutate(
      { id: company.id, data: { business_name: businessName.trim() } },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-ruc">RUC</Label>
        <Input
          id="edit-ruc"
          value={company.ruc}
          disabled
          className="font-mono bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-business-name">Razón Social *</Label>
        <Input
          id="edit-business-name"
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            if (businessNameError) setBusinessNameError("");
          }}
          required
          autoComplete="off"
          className={businessNameError ? "border-destructive" : ""}
        />
        {businessNameError && (
          <p className="text-xs text-destructive">{businessNameError}</p>
        )}
      </div>

      {updateCompany.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {updateCompany.error instanceof Error
              ? updateCompany.error.message
              : "Error al actualizar la empresa"}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateCompany.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={updateCompany.isPending || !businessName.trim()}
        >
          {updateCompany.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditCompanyDialog({
  company,
  open,
  onOpenChange,
}: EditCompanyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Empresa
          </DialogTitle>
          <DialogDescription>
            Modifica la razón social de la empresa. El RUC no puede cambiarse.
          </DialogDescription>
        </DialogHeader>

        {company && (
          <EditForm
            key={company.id}
            company={company}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
