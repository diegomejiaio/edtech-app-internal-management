"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AiSummary } from "@/hooks/use-notifications";
import { AiCriticalityBadge } from "./ai-criticality-badge";
import { cn } from "@/lib/utils";

interface AiSummarySectionProps {
  aiSummary: AiSummary | null;
  className?: string;
}

/** Formats a monetary amount with currency symbol */
function formatAmount(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  const symbol = currency === "USD" ? "US$" : "S/";
  return `${symbol} ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Expandable AI-generated summary section for a SUNAT notification.
 * Renders nothing when ai_summary is null or status is "skipped".
 * Visible for Admin and Member roles (rendered unconditionally — BFF already
 * filters by role; frontend renders whatever the API returns).
 */
export function AiSummarySection({
  aiSummary,
  className,
}: AiSummarySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!aiSummary || aiSummary.status === "skipped") return null;

  const {
    status,
    criticality_reason,
    summary,
    key_amounts,
    deadline_hint,
    required_action,
    document_type_detected,
  } = aiSummary;

  const hasContent = status === "completed" && summary;

  return (
    <div className={cn("space-y-2", className)}>
      <Separator />

      {/* Header row — always visible */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Resumen IA
        </span>
        <AiCriticalityBadge aiSummary={aiSummary} />
      </div>

      {/* Error state */}
      {status === "failed" && (
        <p className="text-xs text-muted-foreground pl-6">
          No se pudo generar el resumen automático.
        </p>
      )}

      {/* Summary — always visible (collapsed preview) */}
      {hasContent && (
        <div className="pl-6 space-y-3">
          <p className="text-sm text-foreground leading-relaxed">{summary}</p>

          {/* Expandable details — hidden by default */}
          {isExpanded && (
            <div className="space-y-3">
              {/* Criticality reason */}
              {criticality_reason && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Motivo de criticidad
                  </p>
                  <p className="text-xs text-foreground">
                    {criticality_reason}
                  </p>
                </div>
              )}

              {/* Required action */}
              {required_action && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Acción requerida
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">
                    {required_action}
                  </p>
                </div>
              )}

              {/* Deadline hint */}
              {deadline_hint && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Plazo / Fecha clave
                  </p>
                  <p className="text-xs text-foreground">{deadline_hint}</p>
                </div>
              )}

              {/* Key amounts */}
              {key_amounts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    Importes clave
                  </p>
                  <div className="grid gap-1">
                    {key_amounts.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">
                          {item.concept}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatAmount(item.amount, item.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Document type + source */}
              {document_type_detected && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {document_type_detected}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Toggle button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? "Ocultar resumen" : "Ver resumen completo"}
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? (
              <>
                Ocultar
                <ChevronUp className="ml-1 h-3 w-3" />
              </>
            ) : (
              <>
                Ver más
                <ChevronDown className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
