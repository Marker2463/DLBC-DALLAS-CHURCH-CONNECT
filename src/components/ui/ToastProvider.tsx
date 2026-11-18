import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastOptions, 'id' | 'message' | 'variant' | 'duration'>> {
  title?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  info: 5000,
  success: 4500,
  warning: 7000,
  error: 8000,
};

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    container: string;
    iconWrapper: string;
    title: string;
    actionBtn: string;
    Icon: typeof Info;
  }
> = {
  info: {
    container: 'bg-surface border-primary/15 text-primary',
    iconWrapper: 'bg-primary/5 text-primary border-primary/10',
    title: 'text-primary',
    actionBtn: 'bg-[#1c202e] text-white hover:bg-[#1c202e]/90',
    Icon: Info,
  },
  success: {
    container: 'bg-surface border-emerald-200 text-primary',
    iconWrapper: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    title: 'text-emerald-950',
    actionBtn: 'bg-emerald-700 text-white hover:bg-emerald-800',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'bg-surface border-amber-200 text-primary',
    iconWrapper: 'bg-amber-50 text-amber-700 border-amber-200',
    title: 'text-amber-950',
    actionBtn: 'bg-[#1c202e] text-white hover:bg-[#1c202e]/90',
    Icon: AlertTriangle,
  },
  error: {
    container: 'bg-surface border-red-200 text-primary',
    iconWrapper: 'bg-red-50 text-[#b93c3c] border-red-200',
    title: 'text-red-950',
    actionBtn: 'bg-[#1c202e] text-white hover:bg-[#1c202e]/90',
    Icon: AlertCircle,
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = VARIANT_STYLES[toast.variant];
  const Icon = style.Icon;

  useEffect(() => {
    if (toast.duration <= 0 || paused) return;
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, paused, onDismiss]);

  return (
    <div
      role={toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto relative w-full rounded-xl border p-4 shadow-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${style.container}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${style.iconWrapper}`}
          aria-hidden="true"
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1 pr-6">
          {toast.title && (
            <p className={`font-serif text-sm font-semibold leading-snug ${style.title}`}>
              {toast.title}
            </p>
          )}
          <p className="font-sans text-xs text-primary-muted leading-relaxed break-words mt-0.5">
            {toast.message}
          </p>

          {toast.action && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                className={`inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 py-1.5 font-sans text-xs font-semibold transition-colors cursor-pointer shadow-xs ${style.actionBtn}`}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-primary-muted hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback((options: ToastOptions): string => {
    const variant = options.variant || 'info';
    const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration =
      typeof options.duration === 'number' ? options.duration : DEFAULT_DURATIONS[variant];

    setToasts((prev) => {
      const next = prev.filter((t) => t.id !== id && t.message !== options.message);
      return [
        ...next.slice(-2),
        {
          id,
          title: options.title,
          message: options.message,
          variant,
          duration,
          action: options.action,
        },
      ];
    });

    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearToasts }}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2.5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-sm pb-[env(safe-area-inset-bottom)]"
      >
        {toasts.map((t) => (
          <React.Fragment key={t.id}>
            <ToastCard toast={t} onDismiss={dismissToast} />
          </React.Fragment>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
