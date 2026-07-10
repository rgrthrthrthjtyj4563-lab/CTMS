import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface EmptyStateProps {
  title: string;
  desc?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  desc,
  action,
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
        {icon ?? <span aria-hidden>?</span>}
      </div>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {desc ? (
        <div className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
