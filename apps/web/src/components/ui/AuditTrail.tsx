import { cn } from "../../lib/cn.js";

export interface AuditEntry {
  time: string;
  user: string;
  action: string;
  ip?: string;
  result?: "成功" | "失败" | string;
}

export interface AuditTrailProps {
  items: ReadonlyArray<AuditEntry>;
  className?: string;
  emptyLabel?: string;
}

export function AuditTrail({ items, className, emptyLabel }: AuditTrailProps) {
  if (items.length === 0) {
    return (
      <div className={cn("text-xs text-slate-400 py-6 text-center", className)}>
        {emptyLabel ?? "暂无审计记录"}
      </div>
    );
  }
  return (
    <div className={cn("divide-y divide-slate-100", className)}>
      {items.map((log, i) => (
        <div key={i} className="py-2.5 flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                {log.time}
              </span>
              <span className="text-xs font-medium text-slate-600">
                {log.user}
              </span>
            </div>
            <div className="text-xs text-slate-700 mt-0.5">{log.action}</div>
            {log.ip ? (
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {log.ip}
              </div>
            ) : null}
          </div>
          {log.result ? (
            <span
              className={cn(
                "text-xs flex-shrink-0",
                log.result === "成功" ? "text-green-600" : "text-red-500",
              )}
            >
              {log.result}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
