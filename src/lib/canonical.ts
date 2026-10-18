export type DateVariant = 'short' | 'long' | 'date' | 'time';

/**
 * Canonical formatDateTime helper.
 * 12-hour, en-US, no seconds, no leading zeros, preserves timezone behavior.
 * - short: Sep 16, 2026 · 10:30 AM
 * - long: Wednesday, September 16, 2026 at 10:30 AM
 * - date: Sep 16, 2026
 * - time: 10:30 AM
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  variant: DateVariant = 'short'
): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  if (variant === 'time') {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  if (variant === 'date') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (variant === 'long') {
    const weekdayDate = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${weekdayDate} at ${time}`;
  }

  // variant === 'short'
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} · ${timePart}`;
}

export type StatusTone = 'amber' | 'green' | 'slate' | 'danger';

export interface StatusConfig {
  label: string;
  tone: StatusTone;
}

export const STATUS_MAP: Record<string, StatusConfig> = {
  under_review: { label: 'Under Review', tone: 'amber' },
  review: { label: 'Under Review', tone: 'amber' },
  submitted: { label: 'Under Review', tone: 'amber' },
  pending: { label: 'Under Review', tone: 'amber' },
  draft: { label: 'Under Review', tone: 'amber' },
  'needs finalization': { label: 'Under Review', tone: 'amber' },
  scheduled: { label: 'Scheduled', tone: 'green' },
  confirmed: { label: 'Scheduled', tone: 'green' },
  completed: { label: 'Completed', tone: 'slate' },
  archived: { label: 'Completed', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  canceled: { label: 'Cancelled', tone: 'slate' },
};

export function getStatusConfig(status?: string | null): StatusConfig {
  if (!status) return { label: 'Under Review', tone: 'amber' };
  const key = status.toLowerCase().trim();
  return STATUS_MAP[key] || { label: status.replace(/_/g, ' '), tone: 'amber' };
}

export const FORMAT_LABELS: Record<string, string> = {
  google_meet: 'Google Meet',
  'google meet': 'Google Meet',
  zoom: 'Zoom',
  in_person: 'In-Person',
  'in-person': 'In-Person',
};

export function formatMeetingMethod(method?: string | null): string {
  if (!method) return 'Google Meet';
  const key = method.toLowerCase().trim();
  return FORMAT_LABELS[key] || (key === 'zoom' ? 'Zoom' : key.includes('person') ? 'In-Person' : 'Google Meet');
}

const HONORIFICS_REGEX = /^(?:pastor|bro\.?|brother|sis\.?|sister|dr\.?|mr\.?|mrs\.?|ms\.?|elder|deacon|rev\.?)\s+/i;

/**
 * getInitials(name):
 * Strip leading honorifics (Pastor, Bro., Brother, Sis., Sister, Dr., Mr., Mrs., Ms., Elder, Deacon, Rev., case-insensitive, optional trailing period);
 * take first letter of first and last remaining tokens;
 * if one token, take its first two letters;
 * always uppercase, always two characters.
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '??';
  let cleaned = name.trim();
  
  while (HONORIFICS_REGEX.test(cleaned)) {
    cleaned = cleaned.replace(HONORIFICS_REGEX, '').trim();
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '??';

  if (tokens.length === 1) {
    const t = tokens[0].replace(/[^a-zA-Z]/g, '') || tokens[0];
    if (t.length >= 2) return t.slice(0, 2).toUpperCase();
    return (t + (tokens[0][1] || ' ')).slice(0, 2).toUpperCase();
  }

  const first = tokens[0].replace(/[^a-zA-Z]/g, '')[0] || tokens[0][0];
  const lastToken = tokens[tokens.length - 1];
  const last = lastToken.replace(/[^a-zA-Z]/g, '')[0] || lastToken[0];
  return (first + last).toUpperCase();
}

/**
 * Button System tokens
 * Sizes: sm, md, lg
 * Variants: primary (navy), secondary (outline), ghost, danger
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const buttonTokens: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90 shadow-sm active-sink transition-colors disabled:opacity-50 cursor-pointer',
  secondary: 'border border-primary/20 text-primary hover:bg-surface-dim transition-colors active-sink disabled:opacity-50 cursor-pointer',
  ghost: 'text-primary/70 hover:text-primary hover:bg-surface-dim/50 transition-colors disabled:opacity-50 cursor-pointer',
  danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors active-sink disabled:opacity-50 cursor-pointer',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded font-medium inline-flex items-center justify-center gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-md font-medium inline-flex items-center justify-center gap-2',
  lg: 'px-6 py-3 text-sm rounded-md font-medium inline-flex items-center justify-center gap-2',
};

/**
 * Standard tertiary text link class
 */
export const tertiaryLinkClass = 'font-sans text-xs font-semibold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer';

export interface CandidateConsultation {
  id: string;
  status?: string;
  scheduledStart?: string | null;
  selectedTime?: string | null;
  scheduledEnd?: string | null;
  durationMinutes?: number | null;
  createdAt?: string | null;
  [key: string]: any;
}

/**
 * F3: Selects the nearest upcoming consultation:
 * - Status must be Scheduled/Confirmed (never Cancelled, Completed, or Under Review).
 * - Excludes any whose end time has passed (end = start + duration, default 45 mins; session in progress still qualifies).
 * - Earliest start time; tie-break: earliest created.
 * - Returns null if none qualify.
 */
export function getNearestUpcomingConsultation<T extends CandidateConsultation>(
  consultations: T[],
  nowMs: number = Date.now()
): T | null {
  const candidates = consultations.filter((c) => {
    const status = (c.status || '').toLowerCase().trim();
    if (status !== 'scheduled' && status !== 'confirmed') {
      return false;
    }
    const startStr = c.scheduledStart || c.selectedTime;
    if (!startStr) return false;
    const start = new Date(startStr).getTime();
    if (isNaN(start)) return false;

    const duration = c.durationMinutes || 45;
    const end = c.scheduledEnd ? new Date(c.scheduledEnd).getTime() : start + duration * 60000;
    if (isNaN(end)) return false;

    // Exclude if end time has passed; in-progress sessions (now <= end) still qualify
    return nowMs <= end;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const startA = new Date(a.scheduledStart || a.selectedTime || 0).getTime();
    const startB = new Date(b.scheduledStart || b.selectedTime || 0).getTime();
    if (startA !== startB) {
      return startA - startB;
    }
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createdA - createdB;
  });

  return candidates[0];
}

/**
 * F3: Detail line format:
 * `Scheduled for {weekday}, {month} {day}, {year} at {h:mm AM/PM}`
 * (e.g. "Scheduled for Tuesday, September 29, 2026 at 4:00 PM")
 */
export function formatBannerScheduledTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'Time Pending';
  return `Scheduled for ${formatDateTime(dateInput, 'long')}`;
}
