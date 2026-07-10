/**
 * Vertical timeline of dated events with an optional dot color per item.
 *
 * Used by the eConsent workflow log and the subject history view. Replaces
 * the prototype's ad-hoc `VISIT_LOG` arrays. Generic over the event shape
 * so callers control timestamps, labels, and dot color.
 */
import type { ReactNode } from "react";

export type TimelineItem = {
  /** ISO timestamp; the column renders YYYY-MM-DD HH:mm. */
  time: string;
  title: string;
  /** Optional supporting copy under the title. */
  description?: string;
  /** Right-side metadata chip (e.g. operator role, signature hash). */
  meta?: string;
  /** Dot color: matches RISK_VISUAL tokens. Defaults to primary. */
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "ai";
  /** Tag rendered next to the title (e.g. AI 草稿, 双向, PI 确认). */
  tag?: string;
};

const TONE_DOT: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "#cbd5e1",
  primary: "var(--primary)",
  success: "#16a34a",
  warning: "#d97706",
  danger: "var(--risk-critical-text)",
  ai: "var(--accent)",
};

const TONE_TAG_BG: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "#f1f5f9",
  primary: "rgba(11,77,162,0.12)",
  success: "rgba(22,163,74,0.12)",
  warning: "rgba(217,119,6,0.14)",
  danger: "rgba(220,38,38,0.12)",
  ai: "rgba(107,82,217,0.16)",
};

const TONE_TAG_FG: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "#475569",
  primary: "var(--primary)",
  success: "#15803d",
  warning: "#b45309",
  danger: "#b91c1c",
  ai: "#6B52D9",
};

function formatTime(iso: string): string {
  if (!iso) return "—";
  // Accept either ISO (2026-07-10T03:01:02.000Z) or the pre-formatted
  // "2026-07-10 03:01:02" strings produced by the audit/dashboard
  // endpoints. Trim anything after seconds.
  return iso.length >= 19 ? iso.slice(0, 19).replace("T", " ") : iso;
}

export function Timeline({
  items,
  emptyText = "暂无记录",
}: {
  items: ReadonlyArray<TimelineItem>;
  emptyText?: string;
}): ReactNode {
  if (items.length === 0) {
    return (
      <div
        className="text-xs text-slate-400 px-3 py-4 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        {emptyText}
      </div>
    );
  }
  return (
    <ol className="relative pl-6">
      {/* continuous vertical rail */}
      <span
        className="absolute left-2 top-1 bottom-1 w-px"
        style={{ background: "#e2e8f0" }}
        aria-hidden
      />
      {items.map((it, idx) => {
        const tone = it.tone ?? "default";
        return (
          <li key={`${it.time}-${idx}`} className="relative pb-4 last:pb-0">
            <span
              className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
              style={{ background: TONE_DOT[tone] }}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs tabular-nums text-slate-400">
                {formatTime(it.time)}
              </span>
              {it.tag ? (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    background: TONE_TAG_BG[tone],
                    color: TONE_TAG_FG[tone],
                  }}
                >
                  {it.tag}
                </span>
              ) : null}
              {it.meta ? (
                <span className="text-[11px] text-slate-400">{it.meta}</span>
              ) : null}
            </div>
            <div className="text-sm font-medium text-slate-700 mt-0.5">
              {it.title}
            </div>
            {it.description ? (
              <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {it.description}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
