import React, { useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

interface CancelConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  role: 'member' | 'leader';
  consultationCategory?: string;
}

export function CancelConsultationModal({
  isOpen,
  onClose,
  onConfirm,
  role,
  consultationCategory,
}: CancelConsultationModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel consultation.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-xl bg-surface p-6 shadow-xl border border-primary/10 text-primary">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-primary/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 id="cancel-dialog-title" className="font-serif text-lg font-semibold text-primary">
              Cancel Consultation
            </h3>
            <p className="font-sans text-xs text-primary/60">
              {consultationCategory ? `${consultationCategory} — ` : ''}
              {role === 'member' ? 'Member cancellation' : 'Pastoral cancellation'}
            </p>
          </div>
        </div>

        <p className="font-sans text-sm text-primary/70 mb-4 leading-relaxed">
          Are you sure you want to cancel this consultation? This action will release any provisioned digital meeting links or schedule holds.
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cancel-reason" className="block font-sans text-xs font-semibold text-primary/80 uppercase tracking-wider mb-1.5">
              Reason for Cancellation <span className="font-normal lowercase text-primary/50">(optional)</span>
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide context for the cancellation (e.g., schedule conflict, resolved issue)..."
              disabled={submitting}
              className="w-full rounded-lg border border-primary/20 bg-background p-3 font-sans text-sm text-primary placeholder:text-primary/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-y"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2 border-t border-primary/10">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-primary/15 bg-surface px-4 py-2 font-sans text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              Keep Consultation
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-stone-800 hover:bg-stone-900 text-white px-5 py-2 font-sans text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <span>Confirm Cancellation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
