import type { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Checkbox({ label, className, checked, ...rest }: CheckboxProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer", className)}>
      <span
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center transition-colors",
          checked
            ? "bg-[var(--primary)] border-[var(--primary)]"
            : "bg-white border-slate-300",
        )}
      >
        {checked ? <Check className="w-3 h-3 text-white" /> : null}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} {...rest} />
      {label ? (
        <span className="text-xs text-slate-700">{label}</span>
      ) : null}
    </label>
  );
}
