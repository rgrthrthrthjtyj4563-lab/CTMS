import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface InfoRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export function InfoRow({ label, value, mono, className }: InfoRowProps) {
  return (
    <div className={cn("flex items-start py-1.5 gap-2", className)}>
      <span className="text-xs text-slate-400 w-24 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={cn(
          "text-xs text-slate-700 flex-1",
          mono ? "font-mono" : "",
        )}
      >
        {value}
      </span>
    </div>
  );
}
