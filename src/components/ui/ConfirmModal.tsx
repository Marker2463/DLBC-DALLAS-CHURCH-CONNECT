import { useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  danger = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-surface p-6 shadow-xl border border-primary/10 text-primary animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-primary-muted hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-6">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
              danger
                ? 'bg-red-50 text-[#b93c3c] border-red-200'
                : 'bg-stone-100 text-stone-700 border-stone-200'
            }`}
          >
            <AlertCircle size={20} />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-modal-title" className="font-serif text-lg font-semibold text-primary">
              {title}
            </h2>
            {subtitle && (
              <p className="font-sans text-xs text-primary-muted truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <p className="font-sans text-sm text-primary-muted mb-6 leading-relaxed">
          {description}
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-primary/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-control bg-surface px-4 py-2 font-sans text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-5 py-2 font-sans text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 ${
              danger
                ? 'bg-[#b93c3c] hover:bg-[#a83232]'
                : 'bg-[#1c202e] hover:bg-[#1c202e]/90'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
