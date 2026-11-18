import React, { useState, useRef, useEffect, useId } from 'react';
import { X, Info } from 'lucide-react';

export interface PopoverProps {
  title?: string;
  children: React.ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerContent?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  widthClass?: string;
}

export function Popover({
  title,
  children,
  triggerLabel = 'More information',
  triggerClassName,
  triggerContent,
  align = 'left',
  widthClass = 'sm:w-80',
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const alignClasses =
    align === 'right'
      ? 'sm:right-0 sm:left-auto'
      : align === 'center'
      ? 'sm:left-1/2 sm:-translate-x-1/2'
      : 'sm:left-0 sm:right-auto';

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={triggerLabel}
        className={
          triggerClassName ||
          'inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-surface px-2.5 py-1.5 font-sans text-xs font-medium text-primary-muted hover:bg-surface-dim hover:text-primary transition-colors cursor-pointer min-h-[34px]'
        }
      >
        {triggerContent || (
          <>
            <Info size={14} className="shrink-0" aria-hidden="true" />
            <span>{triggerLabel}</span>
          </>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop scrim so popover sits cleanly above crushed small viewports */}
          <div
            className="fixed inset-0 z-[85] bg-black/25 backdrop-blur-xs sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            id={panelId}
            role="dialog"
            aria-labelledby={title ? titleId : undefined}
            className={`fixed inset-x-4 bottom-4 z-[90] max-h-[80dvh] overflow-y-auto rounded-xl border border-primary/15 bg-surface p-4 sm:p-5 text-primary shadow-xl animate-in fade-in slide-in-from-bottom-2 sm:slide-in-from-top-1 duration-150 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 ${widthClass} ${alignClasses}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              {title ? (
                <h3
                  id={titleId}
                  className="font-serif text-base font-semibold text-primary leading-snug"
                >
                  {title}
                </h3>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close popover"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-primary-muted hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="font-sans text-xs text-primary-muted leading-relaxed space-y-2">
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
