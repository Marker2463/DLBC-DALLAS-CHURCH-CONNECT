import React from 'react';
import type { ConsultationStatus } from '../types/consultation';
import { cn } from '../lib/utils';

export const STATUS_CONFIG: Record<ConsultationStatus, { label: string; className: string }> = {
  submitted: {
    label: 'Under Review',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  under_review: {
    label: 'Under Review',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  archived: {
    label: 'Archived',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-stone-100 text-stone-700 border-stone-300',
  },
};

interface StatusBadgeProps {
  status?: ConsultationStatus | string | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedKey = (status && status in STATUS_CONFIG)
    ? (status as ConsultationStatus)
    : 'under_review';
  const config = STATUS_CONFIG[normalizedKey];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider border shrink-0 whitespace-nowrap',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
