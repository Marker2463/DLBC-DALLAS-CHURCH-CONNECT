import React from 'react';

export type FilterKey = 'all' | 'scheduled' | 'review' | 'completed' | 'cancelled';

export interface FilterTab {
  key: FilterKey;
  label: string;
}

export const ROSTER_FILTER_TABS: FilterTab[] = [
  { key: 'all', label: 'All Cases' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'review', label: 'Pending Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

/**
 * Filter mapping:
 * - scheduled: scheduled or confirmed
 * - review: under_review, submitted, review, pending, draft, needs finalization
 * - completed: completed or archived
 * - cancelled: cancelled or canceled
 * - all: includes all cases (including cancelled)
 */
export function matchesRosterFilter(status: string | null | undefined, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const s = (status || '').toLowerCase().trim();
  if (filter === 'scheduled') {
    return s === 'scheduled' || s === 'confirmed';
  }
  if (filter === 'review') {
    return (
      s === 'under_review' ||
      s === 'submitted' ||
      s === 'review' ||
      s === 'pending' ||
      s === 'draft' ||
      s === 'needs finalization'
    );
  }
  if (filter === 'completed') {
    return s === 'completed' || s === 'archived';
  }
  if (filter === 'cancelled') {
    return s === 'cancelled' || s === 'canceled';
  }
  return true;
}

interface RosterFilterChipsProps {
  activeFilter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  className?: string;
}

export function RosterFilterChips({
  activeFilter,
  onFilterChange,
  className,
}: RosterFilterChipsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`} role="group" aria-label="Consultations filter">
      {ROSTER_FILTER_TABS.map((tab) => {
        const isSelected = activeFilter === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onFilterChange(tab.key)}
            className={`px-3.5 py-1.5 rounded-full font-sans text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1 ${
              isSelected
                ? 'bg-[#1c202e] text-white shadow-sm'
                : 'bg-white border border-primary/10 text-primary/70 hover:bg-surface-dim'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
