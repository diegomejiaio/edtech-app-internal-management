'use client';

/** Placeholder shown in CRM sub-sections that are not yet implemented. */

import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Planned capabilities, shown as a bulleted list. */
  features?: string[];
  /** Milestone tag, e.g. "Fase 2". */
  phase?: string;
}

export function ComingSoon({ icon: Icon, title, description, features, phase }: ComingSoonProps) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Badge variant="secondary">Próximamente</Badge>
            {phase ? <Badge variant="outline">{phase}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {features?.length ? (
          <ul className="w-full space-y-1.5 rounded-lg border p-4 text-left text-sm text-muted-foreground">
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
