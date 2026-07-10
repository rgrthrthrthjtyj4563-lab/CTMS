import { Button } from "./Button.js";
import { cn } from "../../lib/cn.js";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), lastPage);
  return (
    <div
      className={cn(
        "flex items-center justify-between text-xs text-slate-500",
        className,
      )}
    >
      <span>
        共 <span className="font-medium text-slate-700">{total}</span> 条 · 第{" "}
        <span className="font-medium text-slate-700">{safePage}</span> /{" "}
        {lastPage} 页
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= lastPage}
          onClick={() => onPageChange(safePage + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
