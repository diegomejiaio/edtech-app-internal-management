'use client';

import { Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ReadOnlyFieldProps {
  label: string;
  /** Main value to display. */
  value?: string | null;
  /** Optional secondary line (e.g. document number). */
  hint?: string | null;
}

/**
 * Displays a non-editable field with a clear visual treatment (lock icon, muted
 * background and "No editable" caption) so it is easy to tell apart from inputs.
 */
export function ReadOnlyField({ label, value, hint }: ReadOnlyFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          No editable
        </span>
      </div>
      <div className="rounded-md border border-dashed bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        <p className="break-words font-medium text-foreground/80">{value ?? '—'}</p>
        {hint ? <p className="break-words text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}
