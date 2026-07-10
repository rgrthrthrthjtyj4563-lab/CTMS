import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "ai";

const tones: Record<BadgeTone, { bg: string; text: string }> = {
  neutral: { bg: "#e2e8f0", text: "#334155" },
  primary: { bg: "var(--secondary)", text: "var(--primary)" },
  success: { bg: "#dcfce7", text: "#15803d" },
  warning: { bg: "#fef3c7", text: "#b45309" },
  danger: { bg: "#fee2e2", text: "#b91c1c" },
  ai: { bg: "#ede9fe", text: "#5b21b6" },
};

export interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide",
        className,
      )}
      style={{ background: t.bg, color: t.text }}
    >
      {children}
    </span>
  );
}
