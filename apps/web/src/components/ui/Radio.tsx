import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Radio({ label, className, checked, ...rest }: RadioProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer", className)}>
      <span
        className={cn(
          "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
          checked
            ? "border-[var(--primary)]"
            : "border-slate-300",
        )}
      >
        {checked ? (
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--primary)" }}
          />
        ) : null}
      </span>
      <input type="radio" className="sr-only" checked={checked} {...rest} />
      {label ? (
        <span className="text-xs text-slate-700">{label}</span>
      ) : null}
    </label>
  );
}
