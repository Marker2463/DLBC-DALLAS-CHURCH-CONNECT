import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Video, 
  MapPin, 
  Calendar as CalendarIcon, 
  ExternalLink, 
  Clock, 
  X, 
  Loader2 
} from 'lucide-react';
import { InsetPanel } from './InsetPanel';
import { formatDateTime, formatMeetingMethod } from '../../lib/canonical';
import { Popover } from '../ui/Popover';

export const BUFFER_MINUTES_BEFORE_START = 10;
export const SESSION_OPEN_LEAD_MINUTES = BUFFER_MINUTES_BEFORE_START;
export const DEFAULT_SESSION_DURATION_MINUTES = 45;

export type SessionJoinState = 'upcoming' | 'joinable' | 'ended';

export function calculateJoinState(
  status: string | undefined,
  scheduledStart: string | null | undefined,
  scheduledEnd: string | null | undefined,
  durationMinutes: number = DEFAULT_SESSION_DURATION_MINUTES,
  now: Date = new Date(),
  bufferMinutes: number = BUFFER_MINUTES_BEFORE_START
): SessionJoinState {
  if (!status) return 'upcoming';
  if (status === 'completed' || status === 'cancelled' || status === 'archived') {
    return 'ended';
  }
  if (status !== 'scheduled') {
    return 'upcoming';
  }
  if (!scheduledStart) return 'upcoming';

  const startTime = new Date(scheduledStart);
  if (isNaN(startTime.getTime())) return 'upcoming';

  const durationMs = durationMinutes * 60 * 1000;
  const endTime = scheduledEnd ? new Date(scheduledEnd) : new Date(startTime.getTime() + durationMs);
  const bufferStart = new Date(startTime.getTime() - bufferMinutes * 60 * 1000);

  if (now.getTime() > endTime.getTime()) {
    return 'ended';
  }
  if (now.getTime() >= bufferStart.getTime()) {
    return 'joinable';
  }
  return 'upcoming';
}

export interface DarkHeroCardProps {
  role: 'member' | 'pastor';
  status: string;
  category?: string;
  memberName?: string;
  leaderName?: string;
  selectedTime?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  durationMinutes?: number;
  meetingMethod?: string | null;
  meetingLocation?: string | null;
  googleCalendarUrl?: string;
  cancellationReason?: string | null;
  
  // Handlers
  onEnterSession?: () => void;
  isJoiningSession?: boolean;
  onRescheduleClick?: () => void;
  onCancelClick?: () => void;
  onConfirmAppointment?: () => void;
  isConfirmingAppointment?: boolean;
}

export function DarkHeroCard({
  role,
  status,
  category = 'Pastoral Care',
  memberName,
  leaderName = 'Pastor Samuel Olatunji',
  selectedTime,
  scheduledStart,
  scheduledEnd,
  durationMinutes = DEFAULT_SESSION_DURATION_MINUTES,
  meetingMethod,
  meetingLocation,
  googleCalendarUrl,
  cancellationReason,
  onEnterSession,
  isJoiningSession = false,
  onRescheduleClick,
  onCancelClick,
  onConfirmAppointment,
  isConfirmingAppointment = false,
}: DarkHeroCardProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const timeIso = scheduledStart || selectedTime;
  const joinState = calculateJoinState(
    status,
    timeIso,
    scheduledEnd,
    durationMinutes,
    now,
    BUFFER_MINUTES_BEFORE_START
  );

  const isInPerson = meetingMethod === 'in_person';
  const formatLabel = meetingMethod
    ? isInPerson
      ? `${formatMeetingMethod(meetingMethod)} (${meetingLocation || 'Sanctuary / Office'})`
      : `${formatMeetingMethod(meetingMethod)} Video Call`
    : null;

  const isConfirmed = status === 'scheduled';
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const isUnderReview = !isConfirmed && !isCompleted && !isCancelled;

  // Background styling
  const bgClass = joinState === 'ended' || isCompleted || isCancelled ? 'bg-[#252834]' : 'bg-[#1c202e]';

  return (
    <div className={`${bgClass} rounded-2xl p-5 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden transition-colors`}>
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10">
        {/* Eyebrow */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          {joinState === 'ended' || isCompleted ? (
            <span className="font-sans text-xs text-stone-300 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              SESSION ENDED
            </span>
          ) : isCancelled ? (
            <span className="font-sans text-xs text-red-300 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <X size={14} className="text-red-400" /> CONSULTATION CANCELLED
            </span>
          ) : isConfirmed ? (
            <span className="font-sans text-xs text-stone-300 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>CONFIRMED PASTORAL SESSION</span>
            </span>
          ) : (
            <span className="font-sans text-xs text-stone-300 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400 shrink-0" />
              <span>AWAITING PASTOR CONFIRMATION</span>
            </span>
          )}
        </div>

        {/* Heading */}
        <h2 className="font-serif text-2xl sm:text-3xl text-white mb-2 tracking-tight">
          {isCancelled ? (
            'Consultation Cancelled'
          ) : isCompleted ? (
            'Pastoral Consultation Concluded'
          ) : isConfirmed ? (
            role === 'member'
              ? `Your Session with ${leaderName || 'Pastor Samuel Olatunji'}`
              : `Session with ${memberName || 'Member'}`
          ) : (
            role === 'member'
              ? 'Awaiting Pastor Confirmation'
              : 'Confirm & Finalize This Meeting'
          )}
        </h2>

        {/* Subline */}
        <div className="font-sans text-sm text-stone-300 leading-relaxed mb-6 max-w-2xl">
          {isCancelled ? (
            cancellationReason ? (
              cancellationReason.length > 90 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>Cancellation note attached.</span>
                  <Popover
                    title="Cancellation Reason"
                    triggerLabel="View reason"
                    triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 font-sans text-xs font-medium text-white hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <p>{cancellationReason}</p>
                  </Popover>
                </div>
              ) : (
                <p>{`Reason: ${cancellationReason}`}</p>
              )
            ) : (
              <p>This consultation request has been cancelled.</p>
            )
          ) : isCompleted ? (
            <p>This pastoral guidance session has concluded. Thank you for connecting.</p>
          ) : isConfirmed ? (
            <p>{timeIso ? formatDateTime(timeIso, 'long') : 'Session details confirmed.'}</p>
          ) : role === 'member' ? (
            <p>Your consultation request is currently being reviewed by pastoral leadership. You can adjust your preferred time or cancel below.</p>
          ) : (
            <p>Confirm the requested appointment details and format to finalize the session.</p>
          )}
        </div>

        {/* Inset Panel */}
        <InsetPanel
          leftLabel={isConfirmed ? 'SCHEDULED DATE & TIME' : 'REQUESTED DATE & TIME'}
          leftValue={
            timeIso
              ? formatDateTime(timeIso, 'long')
              : 'No specific time selected'
          }
          rightLabel={formatLabel ? 'FORMAT' : undefined}
          rightValue={formatLabel || undefined}
          rightIcon={
            formatLabel ? (
              isInPerson ? (
                <MapPin size={15} className="text-stone-300" />
              ) : (
                <Video size={15} className="text-stone-300" />
              )
            ) : undefined
          }
        />

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-1">
          {/* Confirmed State Actions */}
          {isConfirmed && (
            <>
              {/* Enter Session Room Button (hidden when ended) */}
              {joinState !== 'ended' && !isInPerson && (
                <div className="flex flex-col items-stretch sm:items-start gap-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onEnterSession}
                    disabled={joinState === 'upcoming' || isJoiningSession}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-white text-[#1c202e] hover:bg-white/95 rounded-xl font-sans text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active-sink cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isJoiningSession ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-primary" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Video size={16} className="text-primary" />
                        <span>Enter Session Room</span>
                      </>
                    )}
                  </button>
                  {joinState === 'upcoming' && (
                    <span className="text-xs text-stone-300 pl-1">
                      Opens 10 minutes before your session
                    </span>
                  )}
                </div>
              )}

              {/* Add to Google Calendar Button */}
              {googleCalendarUrl && (
                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto min-h-[44px] px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-sans text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-white/20 cursor-pointer"
                >
                  <CalendarIcon size={16} className="text-white" />
                  <span>Add to Google Calendar</span>
                  <ExternalLink size={14} className="text-stone-300" />
                </a>
              )}
            </>
          )}

          {/* Under Review Actions (Role: Member) */}
          {isUnderReview && role === 'member' && (
            <>
              {onRescheduleClick && (
                <button
                  type="button"
                  onClick={onRescheduleClick}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-white text-[#1c202e] hover:bg-white/95 rounded-xl font-sans text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active-sink cursor-pointer"
                >
                  <Clock size={16} className="text-primary" />
                  <span>Reschedule Time</span>
                </button>
              )}

              {onCancelClick && (
                <button
                  type="button"
                  onClick={onCancelClick}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-sans text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-white/20 cursor-pointer"
                >
                  <X size={16} className="text-stone-300" />
                  <span>Cancel Request</span>
                </button>
              )}
            </>
          )}

          {/* Under Review Actions (Role: Pastor) */}
          {isUnderReview && role === 'pastor' && (
            <>
              {onConfirmAppointment && (
                <button
                  type="button"
                  onClick={onConfirmAppointment}
                  disabled={isConfirmingAppointment}
                  className="w-full sm:w-auto min-h-[44px] px-7 py-3.5 bg-white text-[#1c202e] hover:bg-white/95 rounded-xl font-sans text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active-sink cursor-pointer disabled:opacity-50"
                >
                  {isConfirmingAppointment ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-primary" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} className="text-emerald-700" />
                      <span>Confirm Requested Appointment</span>
                    </>
                  )}
                </button>
              )}

              {onCancelClick && (
                <button
                  type="button"
                  onClick={onCancelClick}
                  disabled={isConfirmingAppointment}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-sans text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-white/20 cursor-pointer disabled:opacity-50"
                >
                  <X size={16} />
                  <span>Cancel Request</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
