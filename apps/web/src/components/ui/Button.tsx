import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ai"
  | "ghost"
  | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
}

const base =
  "inline-flex items-center gap-1.5 font-medium rounded transition-all select-none cursor-pointer disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
  lg: "px-5 py-2 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-white hover:brightness-110 shadow-sm disabled:opacity-50",
  secondary:
    "bg-[var(--secondary)] text-[var(--primary)] hover:brightness-95 disabled:opacity-50",
  danger:
    "bg-[var(--destructive)] text-white hover:brightness-110 shadow-sm disabled:opacity-50",
  ai: "text-white shadow-sm disabled:opacity-50",
  ghost:
    "text-[var(--muted-foreground)] hover:bg-slate-100 disabled:opacity-50",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const aiStyle =
    variant === "ai"
      ? {
          background:
            "linear-gradient(135deg, var(--accent) 0%, var(--sidebar-primary) 100%)",
          ...style,
        }
      : style;
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      className={cn(base, sizes[size], variants[variant], className)}
      style={aiStyle}
    >
      {icon ? <span className="flex-shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}
