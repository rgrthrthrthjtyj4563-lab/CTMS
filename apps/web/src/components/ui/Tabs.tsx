import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: ReadonlyArray<TabItem>;
  active: string;
  onChange: (id: string) => void;
  className?: string;
  rightAdornment?: ReactNode;
}

export function Tabs({ tabs, active, onChange, className, rightAdornment }: TabsProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-200 ${
        className ?? ""
      }`}
    >
      <div className="flex gap-0">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "var(--primary)" : "#64748b",
              }}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    background: isActive
                      ? "var(--secondary)"
                      : "#f1f5f9",
                    color: isActive ? "var(--primary)" : "#94a3b8",
                  }}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {rightAdornment ? <div className="pr-2">{rightAdornment}</div> : null}
    </div>
  );
}
