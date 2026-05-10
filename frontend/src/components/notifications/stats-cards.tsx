"use client";

import {
  FileText,
  Clock,
  Tag,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/motion/count-up";
import { StaggerList } from "@/components/motion";
import {
  useNotificationsStats,
  type NotificationsStats,
} from "@/hooks/use-notifications";

type Trend = "up" | "down" | "neutral";

interface Stat {
  label: string;
  value: number;
  change: string;
  trend: Trend;
  footer: string;
  icon: typeof FileText;
}

function getTrend(value: number): { change: string; trend: Trend } {
  if (value > 0) return { change: `+${value}`, trend: "up" };
  if (value < 0) return { change: `${value}`, trend: "down" };
  return { change: "0", trend: "neutral" };
}

/** Polling interval during sync (3 seconds) */
const SYNC_POLLING_INTERVAL = 3000;

interface StatsCardsProps {
  /** When true, enables polling to show updated stats in real-time */
  isSyncing?: boolean;
}

export function StatsCards({ isSyncing = false }: StatsCardsProps) {
  const { data: stats, isLoading } = useNotificationsStats({
    refetchInterval: isSyncing ? SYNC_POLLING_INTERVAL : (false as const),
  });

  const STATS: Stat[] = [
    {
      label: "Total Notificaciones",
      value: stats?.total ?? 0,
      ...getTrend(12), // TODO: calcular desde API
      footer: "Desde inicio de mes",
      icon: FileText,
    },
    {
      label: "Últimas 24h",
      value: stats?.ultimas24h ?? 0,
      ...getTrend(stats?.ultimas24h ?? 0),
      footer: stats?.ultimas24h
        ? "Nuevas notificaciones"
        : "Sin nuevas notificaciones",
      icon: Clock,
    },
    {
      label: "Tipos de Documentos",
      value: stats?.tipos ?? 0,
      ...getTrend(1), // TODO: calcular desde API
      footer: "Categorías activas",
      icon: Tag,
    },
    {
      label: "Clientes Activos",
      value: stats?.clientes ?? 0,
      ...getTrend(3), // TODO: calcular desde API
      footer: "Desde el último mes",
      icon: Users,
    },
  ];

  return (
    <StaggerList
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      staggerDelay={0.08}
    >
      {STATS.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-sm font-medium">
              {stat.label}
            </CardDescription>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-5 w-12" />
                </>
              ) : (
                <>
                  <CardTitle className="text-2xl font-bold tabular-nums">
                    <CountUp target={stat.value} />
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      stat.trend === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : stat.trend === "down"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {stat.trend === "up" && (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    )}
                    {stat.trend === "down" && (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    )}
                    {stat.trend === "neutral" && (
                      <Minus className="mr-1 h-3 w-3" />
                    )}
                    {stat.change}
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">{stat.footer}</p>
          </CardFooter>
        </Card>
      ))}
    </StaggerList>
  );
}
