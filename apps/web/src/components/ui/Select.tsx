import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  className?: string;
}

export function Select({ children, className, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={cn(
        "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)]",
        "focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)]",
        "text-slate-700",
        className,
      )}
    >
      {children}
    </select>
  );
}
