import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export type TagTone =
  | "neutral"
  | "primary"
  | "ai"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet";

const tones: Record<TagTone, { bg: string; text: string; border?: string }> = {
  neutral: { bg: "#f1f5f9", text: "#475569" },
  primary: { bg: "var(--secondary)", text: "var(--primary)" },
  ai: { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
  success: { bg: "#f0fdf4", text: "#16a34a" },
  warning: { bg: "#fffbeb", text: "#d97706" },
  danger: { bg: "#fef2f2", text: "#dc2626" },
  info: { bg: "#eff6ff", text: "#3b82f6" },
  violet: { bg: "#f5f3ff", text: "#7c3aed" },
};

export interface TagProps {
  tone?: TagTone;
  size?: "sm" | "md";
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Tag({
  tone = "neutral",
  size = "sm",
  icon,
  className,
  children,
}: TagProps) {
  const t = tones[tone];
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        padding,
        className,
      )}
      style={{
        background: t.bg,
        color: t.text,
        border: t.border ? `1px solid ${t.border}` : undefined,
      }}
    >
      {icon ? <span className="flex-shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}
