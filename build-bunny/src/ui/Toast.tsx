"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "./cn";

export type ToastVariant = "neutral" | "positive" | "warning" | "danger" | "info";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss delay in milliseconds. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return value;
}

const variantBar = {
  neutral: "border-s-ink-faint",
  positive: "border-s-positive",
  warning: "border-s-warning",
  danger: "border-s-danger",
  info: "border-s-info",
} as const;

export interface ToastProviderProps {
  children: ReactNode;
  /** Localized accessible label for each toast's dismiss button. */
  dismissLabel: string;
}

export function ToastProvider({ children, dismissLabel }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...options, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options.duration ?? 5000),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live on the always-mounted region so additions are announced;
          top-end is logical, so toasts move to the top-left in RTL. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed end-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border border-border-token border-s-4 bg-surface-raised p-4 shadow-raised animate-toast-in",
              variantBar[item.variant ?? "neutral"],
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              {item.description !== undefined ? (
                <p className="text-sm text-ink-muted">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => dismiss(item.id)}
              className="-me-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="size-4"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
