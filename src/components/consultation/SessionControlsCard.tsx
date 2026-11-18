import { 
  Video, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Clock, 
  X, 
  Check, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { Consultation } from '../../types/consultation';
import { generateGoogleCalendarUrl } from '../../lib/calendarHelper';
import JoinSessionButton from '../JoinSessionButton';
import { SESSION_OPEN_LEAD_MINUTES } from './DarkHeroCard';

interface SessionControlsCardProps {
  role: 'member' | 'pastor' | 'leader';
  consultation: Consultation;
  now?: Date;
  onTestRoom?: () => void;
  isTestingRoom?: boolean;
  onRescheduleClick?: () => void;
  isEditingTime?: boolean;
  newDate?: string;
  onNewDateChange?: (val: string) => void;
  newTime?: string;
  onNewTimeChange?: (val: string) => void;
  onUpdateTime?: () => void;
  isUpdatingTime?: boolean;
  onCancelClick?: () => void;
  isCancelling?: boolean;
  onFinalizeMeeting?: () => void;
  isSubmittingFinalize?: boolean;
  onMarkCompleted?: () => void;
}

export function SessionControlsCard({
  role,
  consultation,
  now = new Date(),
  onTestRoom,
  isTestingRoom = false,
  onRescheduleClick,
  isEditingTime = false,
  newDate = '',
  onNewDateChange,
  newTime = '',
  onNewTimeChange,
  onUpdateTime,
  isUpdatingTime = false,
  onCancelClick,
  isCancelling = false,
  onFinalizeMeeting,
  isSubmittingFinalize = false,
  onMarkCompleted,
}: SessionControlsCardProps) {
  const isScheduled = consultation.status === 'scheduled' || consultation.status === 'completed';
  const isCancelled = consultation.status === 'cancelled';
  const isCompleted = consultation.status === 'completed';
  const isOnline = consultation.meetingMethod !== 'in_person';

  const startTimeStr = consultation.scheduledStart || consultation.selectedTime;
  const startTime = startTimeStr ? new Date(startTimeStr) : null;
  const durationMs = 45 * 60 * 1000;
  const endTime = consultation.scheduledEnd 
    ? new Date(consultation.scheduledEnd) 
    : (startTime ? new Date(startTime.getTime() + durationMs) : null);

  const bufferStartTime = startTime 
    ? new Date(startTime.getTime() - SESSION_OPEN_LEAD_MINUTES * 60 * 1000) 
    : null;

  const isEnded = Boolean(
    (endTime && now > endTime) || isCompleted
  );
  const isJoinable = Boolean(
    !isEnded && bufferStartTime && now >= bufferStartTime
  );

  const googleCalUrl = generateGoogleCalendarUrl(consultation);
  const meetingLink = consultation.meetUrl || consultation.googleMeetUrl || consultation.meetingLink || (consultation as any)?.meeting?.url || null;

  const title = role === 'member' ? 'Session Controls' : (role === 'leader' ? 'Leader Controls' : 'Pastoral Controls');

  return (
    <div className="bg-surface rounded-xl p-6 halo-border">
      <h2 className="font-sans text-sm font-semibold text-primary mb-4 border-b border-primary/10 pb-2">
        {title}
      </h2>

      <div className="space-y-3">
        {/* Pastor/Leader: Confirm Appointment (when not yet confirmed) */}
        {(role === 'pastor' || role === 'leader') && !isScheduled && !isCancelled && onFinalizeMeeting && (
          <button
            type="button"
            onClick={onFinalizeMeeting}
            disabled={isSubmittingFinalize}
            className="w-full min-h-[44px] bg-[#1c202e] hover:bg-[#1c202e]/90 text-white py-3 px-4 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active-sink cursor-pointer disabled:opacity-50"
          >
            {isSubmittingFinalize ? (
              <Loader2 size={16} className="animate-spin text-white" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-400" aria-hidden="true" />
            )}
            Confirm Appointment
          </button>
        )}

        {/* 1. Enter Session Room (dark primary) */}
        {isScheduled && !isEnded && isOnline && (
          isJoinable ? (
            <JoinSessionButton
              consultationId={consultation.id}
              initialMeetingLink={meetingLink}
              buttonText={role === 'member' ? 'Join Pastoral Session' : 'Start & Host Meeting'}
              loadingText="Connecting..."
              role={role}
              icon={<Video size={16} />}
              showTestButton={false}
              className="w-full min-h-[44px] bg-[#1c202e] hover:bg-[#1c202e]/90 text-white py-3 px-4 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active-sink cursor-pointer disabled:opacity-50"
            />
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="w-full min-h-[44px] bg-[#1c202e]/40 text-white/60 py-3 px-4 rounded-lg font-sans text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Video size={16} aria-hidden="true" />
              Enter Session Room
            </button>
          )
        )}

        {/* 2. Test Room (gray secondary, with sparkle icon inside) */}
        {!isEnded && isOnline && !isCancelled && (
          <button
            type="button"
            onClick={() => {
              if (onTestRoom) {
                onTestRoom();
              } else if (meetingLink && !meetingLink.includes('/new')) {
                window.open(meetingLink, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={isTestingRoom}
            className="w-full min-h-[44px] bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-stone-300 cursor-pointer disabled:opacity-50"
          >
            {isTestingRoom ? (
              <Loader2 size={16} className="animate-spin text-stone-600" aria-hidden="true" />
            ) : (
              <Sparkles size={16} className="text-stone-500 shrink-0" aria-hidden="true" />
            )}
            Test Room
          </button>
        )}

        {/* 3. Add to Google Calendar (outlined) */}
        <a
          href={googleCalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[44px] bg-surface hover:bg-primary/5 text-primary py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-primary/10 cursor-pointer"
        >
          <CalendarIcon size={16} aria-hidden="true" />
          Add to Google Calendar
        </a>

        {/* 4. Reschedule Time (outlined) - for member or pastoral rescheduling */}
        {role === 'member' && !isCompleted && !isCancelled && onRescheduleClick && (
          <button
            type="button"
            onClick={onRescheduleClick}
            className="w-full min-h-[44px] bg-surface hover:bg-primary/5 text-primary py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-primary/10 cursor-pointer"
          >
            <Clock size={16} aria-hidden="true" />
            Reschedule Time
          </button>
        )}

        {/* Reschedule Form Dropdown */}
        {isEditingTime && onUpdateTime && onNewDateChange && onNewTimeChange && (
          <div className="mt-3 p-4 border border-primary/10 rounded-xl bg-[#faf8f5] space-y-3">
            <div>
              <label htmlFor="reschedule-date-input" className="block text-xs font-semibold text-primary mb-1 uppercase tracking-wider">
                New Date
              </label>
              <input 
                id="reschedule-date-input" 
                aria-label="New Date" 
                type="date" 
                value={newDate} 
                onChange={(e) => onNewDateChange(e.target.value)} 
                className="w-full min-h-[44px] bg-white border border-primary/20 rounded-lg p-2.5 text-sm text-primary focus:outline-none focus:border-primary" 
              />
            </div>
            <div>
              <label htmlFor="reschedule-time-input" className="block text-xs font-semibold text-primary mb-1 uppercase tracking-wider">
                New Time
              </label>
              <input 
                id="reschedule-time-input" 
                aria-label="New Time" 
                type="time" 
                value={newTime} 
                onChange={(e) => onNewTimeChange(e.target.value)} 
                className="w-full min-h-[44px] bg-white border border-primary/20 rounded-lg p-2.5 text-sm text-primary focus:outline-none focus:border-primary" 
              />
            </div>
            <button 
              type="button"
              onClick={onUpdateTime} 
              disabled={isUpdatingTime || !newDate || !newTime} 
              className="w-full min-h-[44px] bg-[#1c202e] hover:bg-[#1c202e]/90 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {isUpdatingTime ? 'Updating...' : 'Confirm Reschedule'}
            </button>
          </div>
        )}

        {/* Pastor/Leader: Mark as Completed */}
        {(role === 'pastor' || role === 'leader') && isScheduled && !isCompleted && !isCancelled && onMarkCompleted && (
          <button 
            type="button"
            onClick={onMarkCompleted} 
            className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-white py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 active-sink cursor-pointer"
          >
            <Check size={16} aria-hidden="true" />
            Mark as Completed
          </button>
        )}

        {/* Cancel Consultation / Request (gray/stone button) */}
        {!isCompleted && !isCancelled && onCancelClick && (
          <button
            type="button"
            onClick={onCancelClick}
            disabled={isCancelling}
            className="w-full min-h-[44px] bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-stone-300 cursor-pointer disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
            Cancel Consultation
          </button>
        )}
      </div>
    </div>
  );
}
