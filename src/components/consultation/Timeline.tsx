import { formatDateTime } from '../../lib/canonical';

export interface TimelineEvent {
  status: string;
  timestamp: string;
  description?: string;
  originalTime?: string | null;
}

export interface TimelineProps {
  events?: TimelineEvent[];
  originallyRequestedTime?: string | null;
  className?: string;
}

export function Timeline({
  events = [],
  originallyRequestedTime,
  className = '',
}: TimelineProps) {
  // Render only events with real timestamps; do not invent events
  const validEvents = events.filter((e) => {
    if (!e || !e.timestamp) return false;
    const time = new Date(e.timestamp).getTime();
    return !isNaN(time) && time > 0;
  });

  if (validEvents.length === 0) {
    return (
      <p className="font-sans text-xs text-primary-muted italic py-2">
        No journey events recorded yet.
      </p>
    );
  }

  return (
    <ol className={`relative border-l border-primary/10 ml-3 space-y-6 pb-2 list-none ${className}`}>
      {validEvents.map((item, idx) => {
        const isRescheduled = item.status.toLowerCase().includes('rescheduled');
        const origTime = item.originalTime || (isRescheduled ? originallyRequestedTime : null);

        return (
          <li key={idx} className="relative pl-6">
            <div
              className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            <h3 className="font-sans text-sm font-semibold text-primary">
              {item.status}
            </h3>
            {item.description && (
              <p className="font-sans text-xs text-primary-muted mt-0.5 leading-relaxed">
                {item.description}
              </p>
            )}
            {origTime && (
              <span className="font-sans text-xs text-primary-subtle block mt-0.5 italic">
                Originally requested: {formatDateTime(origTime, 'short')}
              </span>
            )}
            <time
              dateTime={item.timestamp}
              className="font-sans text-xs text-primary-subtle block mt-1"
            >
              {formatDateTime(item.timestamp, 'short')}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
