import { Construction } from "lucide-react";

export interface PlaceholderPageProps {
  title: string;
  phase?: "Phase 2" | "Phase 3" | "Phase 4";
  description: string;
}

export function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      style={{ minHeight: 480 }}
    >
      <div className="w-14 h-14 rounded-full bg-[var(--secondary)] flex items-center justify-center mb-4">
        <Construction className="w-6 h-6 text-[var(--primary)]" />
      </div>
      <h1 className="text-lg font-semibold text-slate-800 mb-1">{title}</h1>
      <p className="text-sm text-slate-500 max-w-md">{description}</p>
      {phase ? (
        <div
          className="mt-4 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          计划交付：{phase}
        </div>
      ) : null}
    </div>
  );
}
