import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export type DrawerWidth = 384 | 480 | 720;

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: DrawerWidth;
  children?: ReactNode;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  width = 384,
  children,
  className,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40",
        open ? "" : "pointer-events-none",
        className,
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 h-full bg-white shadow-2xl flex flex-col transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ width: `${width}px`, maxWidth: "92vw" }}
      >
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
