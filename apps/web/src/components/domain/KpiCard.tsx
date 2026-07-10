import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface KpiCardProps {
  title: string;
  value: ReactNode;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  icon: ReactNode;
  color?: string;
}

/**
 * KPICard mirrors the prototype. Used on the project dashboard for the
 * 5 headline metrics (enrollment, visit completion, ePRO, AE/SAE, tasks).
 */
export function KpiCard({
  title,
  value,
  sub,
  trend,
  trendUp,
  icon,
  color = "var(--primary)",
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100 flex flex-col gap-2 min-h-[112px]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">{title}</span>
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style={{ background: color }}
        >
          {icon}
        </span>
      </div>
      <div
        className="text-2xl font-bold text-slate-800"
        style={{ fontFamily: "var(--font-family)" }}
      >
        {value}
      </div>
      {sub ? <div className="text-xs text-slate-400">{sub}</div> : null}
      {trend ? (
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            trendUp ? "text-green-600" : "text-red-500"
          }`}
        >
          {trendUp ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {trend}
        </div>
      ) : null}
    </div>
  );
}
