import React from 'react';
import { cn } from '../lib/utils';

interface QuoteFeatureProps {
  quote: string;
  citation?: string;
  className?: string;
  showDecorativeGlyph?: boolean;
}

export function QuoteFeature({
  quote,
  citation,
  className,
  showDecorativeGlyph = false,
}: QuoteFeatureProps) {
  // Strip any existing quotes and wrap with curly quotes “ ”
  const cleanQuote = quote.replace(/^["“”'\s]+/, '').replace(/["“”'\s]+$/, '').trim();

  return (
    <div className={cn('text-center max-w-3xl mx-auto py-8 relative', className)}>
      {showDecorativeGlyph && (
        <div className="font-serif text-[32px] text-primary/20 mb-3 select-none leading-none">
          “
        </div>
      )}
      <p className="font-serif text-2xl md:text-3xl text-primary leading-relaxed italic">
        “{cleanQuote}”
      </p>
      {citation && (
        <p className="font-sans text-xs text-primary-muted uppercase tracking-widest font-semibold mt-4">
          {citation}
        </p>
      )}
    </div>
  );
}

interface QuoteInlineProps {
  quote: string;
  citation?: string;
  className?: string;
}

export function QuoteInline({ quote, citation, className }: QuoteInlineProps) {
  const cleanQuote = quote.replace(/^["“”'\s]+/, '').replace(/["“”'\s]+$/, '').trim();

  return (
    <div className={cn('border-l-2 border-secondary/50 pl-4 py-1', className)}>
      <p className="font-serif text-lg text-primary italic leading-relaxed">
        “{cleanQuote}”
        {citation && (
          <span className="font-sans text-sm text-primary-muted not-italic ml-2 font-normal">
            — {citation}
          </span>
        )}
      </p>
    </div>
  );
}
