import { Zap, Check } from "lucide-react";
import { AITag } from "./AITag.js";
import { Button } from "../ui/Button.js";

export interface AISuggestionCardProps {
  title: string;
  content: string;
  source?: string;
  generatedAt?: string;
  onConfirm?: () => void;
  onViewSource?: () => void;
}

/**
 * AISuggestionCard mirrors the prototype. Surfaces AI-generated content
 * with the mandatory AI label, source attribution, generated time, and
 * human-confirmation action — the four mandatory fields per plan §1.5
 * and architecture rule "AI content must always be labelled".
 */
export function AISuggestionCard({
  title,
  content,
  source,
  generatedAt,
  onConfirm,
  onViewSource,
}: AISuggestionCardProps) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "#f5f3ff", borderColor: "#c4b5fd" }}
    >
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AITag label="AI生成草稿" />
          <span className="text-sm font-semibold text-violet-900">{title}</span>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          {source ? <span>依据：{source}</span> : null}
          {generatedAt ? <span>· {generatedAt}</span> : null}
        </div>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed mb-3">{content}</p>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <Zap className="w-3 h-3 text-violet-600" />
        人工确认后将以您的名义记录，并保留 AI 来源标注
      </div>
      {(onConfirm || onViewSource) && (
        <div className="flex items-center gap-2">
          {onConfirm ? (
            <Button
              variant="ai"
              size="sm"
              onClick={onConfirm}
              icon={<Check className="w-3 h-3" />}
            >
              人工确认
            </Button>
          ) : null}
          {onViewSource ? (
            <Button variant="ghost" size="sm" onClick={onViewSource}>
              查看依据
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
