import React from 'react';

export interface MetaRowProps {
  urgency?: string | null;
  category?: string | null;
  stage?: string | null;
  className?: string;
}

export function MetaRow({
  urgency = 'Normal',
  category = 'Spiritual Guidance',
  stage = 'under_review',
  className = '',
}: MetaRowProps) {
  const isHighUrgency = urgency?.toLowerCase() === 'high';
  const stageFormatted = (stage || 'Under Review').replace(/_/g, ' ');

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-6 border-t border-primary/10 pt-6 ${className}`}>
      <div>
        <span className="block font-sans text-xs text-primary-muted uppercase tracking-widest mb-1">
          Urgency
        </span>
        <span
          className={`font-sans text-sm font-semibold uppercase ${
            isHighUrgency ? 'text-red-700' : 'text-primary'
          }`}
        >
          {urgency || 'Normal'}
        </span>
      </div>
      <div>
        <span className="block font-sans text-xs text-primary-muted uppercase tracking-widest mb-1">
          Category
        </span>
        <span className="font-sans text-sm font-semibold text-primary">
          {category || 'Spiritual Guidance'}
        </span>
      </div>
      <div>
        <span className="block font-sans text-xs text-primary-muted uppercase tracking-widest mb-1">
          Timeline Stage
        </span>
        <span className="font-sans text-sm font-semibold text-primary capitalize">
          {stageFormatted}
        </span>
      </div>
    </div>
  );
}
