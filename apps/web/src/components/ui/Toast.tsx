import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export type ToastTone = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

type Listener = (toasts: Toast[]) => void;

const state: { toasts: Toast[]; listeners: Set<Listener> } = {
  toasts: [],
  listeners: new Set(),
};

function emit() {
  for (const l of state.listeners) l(state.toasts);
}

export function pushToast(input: Omit<Toast, "id">): string {
  const id = `t-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const toast: Toast = { id, durationMs: 3500, ...input };
  state.toasts = [...state.toasts, toast];
  emit();
  if (toast.durationMs && toast.durationMs > 0) {
    setTimeout(() => dismissToast(id), toast.durationMs);
  }
  return id;
}

export function dismissToast(id: string): void {
  state.toasts = state.toasts.filter((t) => t.id !== id);
  emit();
}

const toneIcon: Record<ToastTone, JSX.Element> = {
  success: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  error: <XCircle className="w-4 h-4 text-red-600" />,
  info: <Info className="w-4 h-4 text-blue-600" />,
};

const toneRing: Record<ToastTone, string> = {
  success: "border-green-200",
  warning: "border-amber-200",
  error: "border-red-200",
  info: "border-blue-200",
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>(state.toasts);
  useEffect(() => {
    state.listeners.add(setToasts);
    return () => {
      state.listeners.delete(setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-2.5 bg-white border rounded-lg shadow-md p-3",
            toneRing[t.tone],
          )}
        >
          <span className="flex-shrink-0 mt-0.5">{toneIcon[t.tone]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800">{t.title}</div>
            {t.description ? (
              <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => dismissToast(t.id)}
            aria-label="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
