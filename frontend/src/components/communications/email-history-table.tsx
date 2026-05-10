"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Building2,
  User,
  Mail,
  Clock,
  AlertCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmailStatusBadge } from "./email-status-badge";
import { useRetryEmail } from "@/hooks/use-email-notifications";
import { cn } from "@/lib/utils";
import { ScrollTable } from "@/components/ui/scroll-table";
import type { EmailNotification } from "@/types";

interface EmailHistoryTableProps {
  emails: EmailNotification[];
  isLoading?: boolean;
  className?: string;
}

export function EmailHistoryTable({
  emails,
  isLoading,
  className,
}: EmailHistoryTableProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const retryEmail = useRetryEmail();

  const handleRetry = async (emailId: string) => {
    setRetryingId(emailId);
    setRetryError(null);
    try {
      await retryEmail.mutateAsync(emailId);
      // Success: list will auto-refresh via invalidateQueries
    } catch (error) {
      setRetryError(
        error instanceof Error ? error.message : "Error al reintentar",
      );
    } finally {
      setRetryingId(null);
    }
  };

  if (isLoading) {
    return <EmailHistoryTableSkeleton />;
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Mail className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Sin correos enviados</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          No se encontraron correos en el periodo seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {retryError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{retryError}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setRetryError(null)}
          >
            Cerrar
          </Button>
        </div>
      )}
      <ScrollTable className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((email) => (
              <TableRow key={email.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {email.company_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {email.company_ruc}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate">{email.contact_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {email.contact_email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="max-w-[200px] truncate">
                          {email.subject}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[300px]">
                        <p>{email.subject}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <EmailStatusBadge status={email.status} />
                    {email.error && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px]">
                            <p className="font-medium">{email.error.code}</p>
                            <p className="text-xs">{email.error.message}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {email.status === "failed" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleRetry(email.id)}
                              disabled={retryingId === email.id}
                            >
                              {retryingId === email.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Reintentar envío</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-sm">
                            {format(
                              new Date(email.created_at),
                              "dd MMM HH:mm",
                              {
                                locale: es,
                              },
                            )}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-1">
                          <p>
                            Creado:{" "}
                            {format(
                              new Date(email.created_at),
                              "dd/MM/yyyy HH:mm:ss",
                              { locale: es },
                            )}
                          </p>
                          {email.sent_at && (
                            <p>
                              Enviado:{" "}
                              {format(
                                new Date(email.sent_at),
                                "dd/MM/yyyy HH:mm:ss",
                                { locale: es },
                              )}
                            </p>
                          )}
                          {email.delivered_at && (
                            <p>
                              Entregado:{" "}
                              {format(
                                new Date(email.delivered_at),
                                "dd/MM/yyyy HH:mm:ss",
                                { locale: es },
                              )}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
    </div>
  );
}

function EmailHistoryTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Asunto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
