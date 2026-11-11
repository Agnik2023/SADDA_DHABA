import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextToastId++;
      setToasts((current) => [...current.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[110] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const Icon =
            toast.kind === "success"
              ? CheckCircle2
              : toast.kind === "error"
                ? AlertCircle
                : Info;
          const classes =
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-stone-200 bg-white text-stone-900";
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-xl ${classes}`}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 leading-relaxed">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 opacity-60 transition hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
