import React from 'react';

export interface InsetPanelProps {
  leftLabel: string;
  leftValue: React.ReactNode;
  rightLabel?: string;
  rightValue?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

export function InsetPanel({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  rightIcon,
  className = '',
}: InsetPanelProps) {
  const hasRightColumn = Boolean(rightLabel && rightValue);

  return (
    <div
      className={`bg-white/10 rounded-xl p-5 border border-white/15 mb-6 text-sm font-sans ${
        hasRightColumn ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'block'
      } ${className}`}
    >
      <div>
        <span className="block text-xs uppercase tracking-wider text-stone-300 font-semibold mb-1">
          {leftLabel}
        </span>
        <span className="font-bold text-white text-base block">
          {leftValue}
        </span>
      </div>

      {hasRightColumn && (
        <div>
          <span className="block text-xs uppercase tracking-wider text-stone-300 font-semibold mb-1">
            {rightLabel}
          </span>
          <span className="font-medium text-white/95 text-base flex items-center gap-1.5">
            {rightIcon && <span className="text-white/80 shrink-0">{rightIcon}</span>}
            <span>{rightValue}</span>
          </span>
        </div>
      )}
    </div>
  );
}
