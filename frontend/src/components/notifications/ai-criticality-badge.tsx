"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { badgeVariants } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Info, Eye, Archive } from "lucide-react";
import { AiSummary, CriticalityLevel } from "@/hooks/use-notifications";

interface AiCriticalityBadgeProps {
  aiSummary: AiSummary | null;
  className?: string;
}

/** Tailwind classes per criticality level — maps to semantic colors (7-level taxonomy) */
const CRITICALITY_CLASS: Record<CriticalityLevel, string> = {
  CRÍTICO:
    "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  URGENTE:
    "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  PREVENTIVO:
    "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  IMPORTANTE:
    "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  REVISAR:
    "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  INFORMATIVO:
    "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700",
  HISTÓRICO:
    "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted",
};

const CRITICALITY_LABEL: Record<CriticalityLevel, string> = {
  CRÍTICO: "Crítico",
  URGENTE: "Urgente",
  PREVENTIVO: "Preventivo",
  IMPORTANTE: "Importante",
  REVISAR: "Revisar",
  INFORMATIVO: "Informativo",
  HISTÓRICO: "Histórico",
};

// motion.span wraps the Badge span directly — no extra DOM node
const MotionSpan = motion.span;

const entryVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

/** Badge that reflects the AI-generated criticality of a SUNAT notification. */
export function AiCriticalityBadge({
  aiSummary,
  className,
}: AiCriticalityBadgeProps) {
  if (!aiSummary) return null;

  const { status, criticality_level } = aiSummary;

  if (status === "skipped") return null;

  if (status === "failed") {
    return (
      <MotionSpan
        data-slot="badge"
        variants={entryVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          badgeVariants({ variant: "outline" }),
          "gap-1 text-xs border-muted-foreground/30 text-muted-foreground",
          className,
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        Sin resumen
      </MotionSpan>
    );
  }

  if ((status === "completed" || status === "fallback") && criticality_level) {
    return (
      <MotionSpan
        data-slot="badge"
        variants={entryVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          badgeVariants({ variant: "outline" }),
          "gap-1 text-xs font-medium border",
          CRITICALITY_CLASS[criticality_level],
          className,
        )}
      >
        {(criticality_level === "CRÍTICO" ||
          criticality_level === "URGENTE") && (
          <AlertTriangle className="h-3 w-3" />
        )}
        {(criticality_level === "INFORMATIVO" ||
          criticality_level === "REVISAR") && <Info className="h-3 w-3" />}
        {criticality_level === "HISTÓRICO" && <Archive className="h-3 w-3" />}
        {criticality_level === "PREVENTIVO" && <Eye className="h-3 w-3" />}
        {CRITICALITY_LABEL[criticality_level]}
      </MotionSpan>
    );
  }

  // Fallback: processing — spinner already animates, no entry animation needed
  return (
    <span
      data-slot="badge"
      className={cn(
        badgeVariants({ variant: "outline" }),
        "gap-1 text-xs text-muted-foreground border-muted-foreground/30",
        className,
      )}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Analizando
    </span>
  );
}
