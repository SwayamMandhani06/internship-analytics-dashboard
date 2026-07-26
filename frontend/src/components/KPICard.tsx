import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  icon?: LucideIcon;
}

export function KPICard({ label, value, trend, icon: Icon }: KPICardProps) {
  return (
    <div className="animate-fade-in rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          {/* Eyebrow label */}
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>

          {/* KPI value */}
          <p className="tabular-nums mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {value}
          </p>

          {/* Trend indicator */}
          {trend && (
            <div
              className={clsx(
                "mt-2 flex items-center gap-1 text-sm font-medium",
                trend.direction === "up"
                  ? "text-success-600"
                  : "text-danger-600"
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span className="tabular-nums">
                {trend.direction === "up" ? "+" : ""}
                {trend.value}%
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <div className="ml-4 flex-shrink-0 rounded-md bg-slate-100 p-2.5 dark:bg-slate-800">
            <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
}
