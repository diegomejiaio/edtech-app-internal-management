"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileTextIcon, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthContext } from "@/providers/auth-provider";

interface PdfViewerProps {
  notificationId: string;
  title?: string;
  iconOnly?: boolean;
}

interface DocumentResponse {
  download_url: string;
  expires_in_minutes: number;
  filename: string;
}

export function PdfViewer({
  notificationId,
  title = "Documento PDF",
  iconOnly = false,
}: PdfViewerProps) {
  const [open, setOpen] = useState(false);
  const { getToken } = useAuthContext();

  // Use TanStack Query - only fetches when dialog is open
  const { data, isLoading, error } = useQuery({
    queryKey: ["notification-document", notificationId],
    queryFn: async () => {
      const token = await getToken();
      return api.get<DocumentResponse>(
        `/notifications/${notificationId}/document`,
        { token },
      );
    },
    enabled: open, // Only fetch when dialog opens
    staleTime: 14 * 60 * 1000, // URL valid for 15 min, cache for 14
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Ver PDF"
          >
            <FileTextIcon className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <FileTextIcon className="mr-1 h-4 w-4" />
            PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col w-[95vw] sm:max-w-7xl h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="truncate pr-8 text-base">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Visor de documento PDF de notificación SUNAT
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive">
              {error instanceof Error
                ? error.message
                : "Error al cargar documento"}
            </div>
          ) : data?.download_url ? (
            <iframe
              src={data.download_url}
              className="w-full h-full rounded-md border-0"
              title={title}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
