import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  data: ReadonlyArray<T>;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyLabel?: string;
  className?: string;
  /** Per-row left border color (e.g. risk level for clinical tables). */
  rowAccent?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  rowKey,
  emptyLabel = "暂无数据",
  className,
  rowAccent,
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap",
                  c.align === "right"
                    ? "text-right"
                    : c.align === "center"
                      ? "text-center"
                      : "text-left",
                )}
                style={c.width ? { width: c.width } : {}}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-10 text-center text-xs text-slate-400"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const accent = rowAccent?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    "border-b border-slate-100 transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-blue-50/50" : "hover:bg-slate-50",
                  )}
                  style={
                    accent
                      ? { borderLeft: `3px solid ${accent}` }
                      : undefined
                  }
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 text-slate-700",
                        c.align === "right"
                          ? "text-right"
                          : c.align === "center"
                            ? "text-center"
                            : "text-left",
                      )}
                      style={{ height: "48px" }}
                    >
                      {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
