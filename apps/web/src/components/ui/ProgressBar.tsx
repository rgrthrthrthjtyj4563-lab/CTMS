import { cn } from "../../lib/cn.js";

export interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  size?: "sm" | "md";
  className?: string;
  showValue?: boolean;
}

export function ProgressBar({
  value,
  max,
  color = "var(--primary)",
  size = "md",
  className,
  showValue = false,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-1 bg-slate-100 rounded-full overflow-hidden", h)}>
        <div
          className={cn("rounded-full transition-all", h)}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showValue ? (
        <span className="text-xs font-medium text-slate-600 w-8 text-right">
          {Math.round(pct)}
        </span>
      ) : null}
    </div>
  );
}
