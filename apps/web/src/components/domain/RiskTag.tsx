import { Tag } from "../ui/Tag.js";
import { RISK_LABELS, RISK_VISUAL, type RiskLevel } from "../../domain/types.js";

export interface RiskTagProps {
  level: RiskLevel;
  size?: "sm" | "md";
  showDot?: boolean;
}

/**
 * RiskBadge extracted from prototype `RiskBadge`. Renders the canonical
 * 4-level clinical risk tag with a left-dot indicator. Used in tables,
 * cards, and side panels.
 */
export function RiskTag({ level, size = "sm", showDot = true }: RiskTagProps) {
  const v = RISK_VISUAL[level];
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding}`}
      style={{
        background: v.bg,
        color: v.text,
        border: `1px solid ${v.border}`,
      }}
    >
      {showDot ? (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: v.dot }}
        />
      ) : null}
      {RISK_LABELS[level]}
    </span>
  );
}
