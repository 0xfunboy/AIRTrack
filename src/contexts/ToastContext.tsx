import React, { createContext, useContext, useCallback, useMemo, useState, ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number; // ms, default auto-dismiss
}

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children?: ReactNode;
}

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = Date.now() + Math.random();
      const variant = options?.variant ?? 'info';
      const duration = options?.duration ?? DEFAULT_DURATION;

      setToasts((prev) => [...prev, { id, message, variant }]);

      if (duration !== 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm">
        {toasts.map(({ id, message, variant }) => {
          const color = variant === 'success'
            ? 'bg-emerald-500/90 text-white border-emerald-300/80'
            : variant === 'error'
              ? 'bg-red-600/90 text-white border-red-400/80'
              : 'bg-gray-900/90 text-gray-100 border-white/10';
          return (
            <div
              key={id}
              className={`border px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm flex items-start justify-between gap-4 ${color}`}
            >
              <span className="text-sm font-medium whitespace-pre-line">{message}</span>
              <button
                onClick={() => dismissToast(id)}
                className="text-xs uppercase tracking-wide opacity-70 hover:opacity-100"
              >
                Close
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
