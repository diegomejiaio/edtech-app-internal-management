"use client";

import { Pencil, Trash2, Users, KeyRound, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Company } from "@/types";

interface CompanyActionsProps {
  company: Company;
  onOpenEdit: (company: Company) => void;
  onOpenContacts: (company: Company) => void;
  onOpenCredentials: (company: Company) => void;
  onOpenApiCredentials: (company: Company) => void;
  onOpenDelete: (company: Company) => void;
}

export function CompanyActions({
  company,
  onOpenEdit,
  onOpenContacts,
  onOpenCredentials,
  onOpenApiCredentials,
  onOpenDelete,
}: CompanyActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenEdit(company)}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Editar empresa</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar empresa</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenContacts(company)}
          >
            <Users className="h-4 w-4" />
            <span className="sr-only">Gestionar contactos</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Gestionar contactos</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenCredentials(company)}
          >
            <KeyRound className="h-4 w-4" />
            <span className="sr-only">
              {company.has_credentials
                ? "Actualizar credenciales SOL"
                : "Configurar credenciales SOL"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {company.has_credentials
            ? "Actualizar credenciales SOL"
            : "Configurar credenciales SOL"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenApiCredentials(company)}
          >
            <Code2 className="h-4 w-4" />
            <span className="sr-only">
              {company.has_api_credentials
                ? "Actualizar API Key"
                : "Configurar API Key"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {company.has_api_credentials
            ? "Actualizar API Key"
            : "Configurar API Key"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onOpenDelete(company)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Eliminar empresa</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Eliminar empresa</TooltipContent>
      </Tooltip>
    </div>
  );
}
