import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface SectionHeaderProps {
  title: string;
  sub?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, sub, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {sub ? <p className="text-xs text-slate-500 mt-0.5">{sub}</p> : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
