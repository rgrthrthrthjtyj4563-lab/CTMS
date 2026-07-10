import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Adds a colored left border to flag risk. */
  riskAccent?: "low" | "medium" | "high" | "critical" | null;
}

const riskAccentColor: Record<NonNullable<CardProps["riskAccent"]>, string> = {
  low: "var(--risk-low-text)",
  medium: "var(--risk-medium-text)",
  high: "var(--risk-high-text)",
  critical: "var(--risk-critical-text)",
};

export function Card({ className, children, riskAccent, style, ...rest }: CardProps) {
  const accentStyle =
    riskAccent
      ? { borderLeft: `4px solid ${riskAccentColor[riskAccent]}` }
      : {};
  return (
    <div
      {...rest}
      className={cn(
        "bg-white rounded-lg p-4 shadow-sm border border-slate-100",
        className,
      )}
      style={{ ...accentStyle, ...style }}
    >
      {children}
    </div>
  );
}
