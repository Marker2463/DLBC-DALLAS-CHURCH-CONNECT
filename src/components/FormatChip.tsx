import React from 'react';
import { Video, MapPin } from 'lucide-react';
import { formatMeetingMethod } from '../lib/canonical';

interface FormatChipProps {
  method?: string | null;
  className?: string;
}

/**
 * Canonical FormatChip: displays Google Meet, Zoom, or In-Person.
 * Both In-Person (MapPin) and video calls (Video) strictly use muted slate (text-primary/60),
 * preventing color divergence across roles and screens.
 */
export function FormatChip({ method, className }: FormatChipProps) {
  const isInPerson = method === 'in_person' || method === 'In-Person';
  const label = formatMeetingMethod(method);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#faf8f5] border border-primary/10 text-primary/80 whitespace-nowrap text-xs font-medium ${
        className || ''
      }`}
    >
      {isInPerson ? (
        <MapPin size={12} className="text-primary/60 shrink-0" />
      ) : (
        <Video size={12} className="text-primary/60 shrink-0" />
      )}
      <span>{label}</span>
    </span>
  );
}
