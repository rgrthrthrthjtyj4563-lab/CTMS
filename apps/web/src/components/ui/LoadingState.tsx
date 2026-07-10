import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "加载中…", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-slate-400",
        className,
      )}
    >
      <Loader2 className="w-5 h-5 animate-spin mb-2" />
      <span className="text-xs">{label}</span>
    </div>
  );
}
