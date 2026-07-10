import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: string;
}

export function Input({ icon, error, className, ...rest }: InputProps) {
  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 rounded-lg",
          "bg-[var(--input-background)] border border-slate-200",
          "focus-within:ring-1 focus-within:ring-[var(--ring)] focus-within:border-[var(--ring)]",
          error ? "border-[var(--destructive)]" : "",
        )}
      >
        {icon ? <span className="text-slate-400 flex-shrink-0">{icon}</span> : null}
        <input
          {...rest}
          className={cn(
            "flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400",
            className,
          )}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-[var(--destructive)]">{error}</p>
      ) : null}
    </div>
  );
}
