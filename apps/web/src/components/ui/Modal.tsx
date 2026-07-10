import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button.js";
import { cn } from "../../lib/cn.js";

export type ModalVariant =
  | "confirm"
  | "high-risk-confirm"
  | "ai-confirm"
  | "delete-confirm"
  | "export-confirm"
  | "protocol-activate"
  | "close-alert"
  | "adopt-ai-note";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  variant: ModalVariant | null;
  title?: string;
  body?: ReactNode;
  footer?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  className?: string;
}

const variantDefaults: Record<
  ModalVariant,
  { title: string; confirmLabel: string; danger?: boolean; ai?: boolean }
> = {
  confirm: { title: "确认操作", confirmLabel: "确认提交" },
  "high-risk-confirm": {
    title: "高风险操作确认",
    confirmLabel: "确认关闭预警",
    danger: true,
  },
  "ai-confirm": { title: "确认 AI 输出内容", confirmLabel: "确认并采用", ai: true },
  "delete-confirm": { title: "删除确认", confirmLabel: "确认删除", danger: true },
  "export-confirm": { title: "敏感数据导出确认", confirmLabel: "确认导出", danger: true },
  "protocol-activate": { title: "方案配置生效确认", confirmLabel: "确认生效" },
  "close-alert": {
    title: "关闭高风险预警",
    confirmLabel: "确认关闭",
    danger: true,
  },
  "adopt-ai-note": { title: "采用 AI 草稿", confirmLabel: "保存", ai: true },
};

export function Modal({
  open,
  onClose,
  variant,
  title,
  body,
  footer,
  confirmLabel,
  cancelLabel = "取消",
  onConfirm,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !variant) return null;

  const defaults = variantDefaults[variant];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col",
          className,
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">
            {title ?? defaults.title}
          </h3>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{body}</div>
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          {footer ?? (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button
                variant={
                  defaults.ai
                    ? "ai"
                    : defaults.danger
                      ? "danger"
                      : "primary"
                }
                size="sm"
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
              >
                {confirmLabel ?? defaults.confirmLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
