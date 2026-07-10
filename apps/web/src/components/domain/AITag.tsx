import { Zap } from "lucide-react";

export interface AITagProps {
  label?: string;
}

/**
 * AITag mirrors the prototype `AITag` — a small badge that tags any
 * UI element as AI-generated or AI-suggested. Mandatory per architecture
 * rules: AI content must always be labelled as such.
 */
export function AITag({ label = "AI建议" }: AITagProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: "#ede9fe",
        color: "#5b21b6",
        border: "1px solid #c4b5fd",
      }}
    >
      <Zap className="w-3 h-3" />
      {label}
    </span>
  );
}
