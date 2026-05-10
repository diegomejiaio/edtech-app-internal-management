"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

interface CredentialStatusProps {
  hasCredentials: boolean;
}

export function CredentialStatus({ hasCredentials }: CredentialStatusProps) {
  if (hasCredentials) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm">Sí</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4" />
      <span className="text-sm">No</span>
    </div>
  );
}
