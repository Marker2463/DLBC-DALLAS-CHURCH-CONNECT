import { Consultation } from '../../types/consultation';
import { formatDateTime } from '../../lib/canonical';

interface JourneyTimelineCardProps {
  consultation: Consultation;
}

export function JourneyTimelineCard({ consultation }: JourneyTimelineCardProps) {
  // Filter only events that have real timestamps
  const rawEvents = consultation.journeyTimeline || [];
  const realEvents = rawEvents.filter(
    (item) => item && typeof item.timestamp === 'string' && item.timestamp.trim().length > 0
  );

  return (
    <div className="bg-surface rounded-xl p-6 halo-border">
      <h2 className="font-sans text-xs text-primary-muted uppercase tracking-widest font-semibold mb-6">
        Consultation Journey
      </h2>

      {/* Accessible ordered list for timeline */}
      <ol className="relative border-l border-primary/10 ml-3 space-y-6 pb-2 list-none">
        {realEvents.map((item, idx) => {
          const isRescheduleEvent = 
            item.status?.toLowerCase().includes('rescheduled') ||
            item.description?.toLowerCase().includes('rescheduled');

          const originalTime = (item as any).originalTime || consultation.originallyRequestedTime;

          return (
            <li key={idx} className="relative pl-6">
              <div 
                aria-hidden="true" 
                className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" 
              />
              <h3 className="font-sans text-sm font-semibold text-primary">
                {item.status}
              </h3>
              <p className="font-sans text-xs text-primary-muted mt-0.5 leading-relaxed">
                {item.description}
              </p>

              {/* If time was changed / rescheduled, display originally requested date/time */}
              {isRescheduleEvent && originalTime && (
                <p className="font-sans text-xs text-primary-muted/90 mt-1 italic">
                  Originally requested: {formatDateTime(originalTime, 'short')}
                </p>
              )}

              <span className="font-sans text-xs text-primary-subtle block mt-1">
                {formatDateTime(item.timestamp, 'short')}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

