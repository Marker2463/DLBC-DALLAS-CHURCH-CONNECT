'use client';

import React, { useState } from 'react';
import { createConsultationMeeting } from '../lib/googleMeetClient';
import { useToast } from './ui/ToastProvider';
import { Video } from 'lucide-react';

export interface JoinSessionButtonProps {
  consultationId: string;
  initialMeetingLink?: string | null;
  className?: string;
  buttonText?: string;
  loadingText?: string;
  icon?: React.ReactNode;
  showTestButton?: boolean;
  onJoinSuccess?: (url: string) => void;
  role?: 'pastor' | 'leader' | 'member';
}

export default function JoinSessionButton({
  consultationId,
  className,
  buttonText = 'Join Meeting',
  loadingText = 'Opening Meeting...',
  icon,
  onJoinSuccess,
}: JoinSessionButtonProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);

    try {
      const meeting = await createConsultationMeeting(consultationId);

      if (onJoinSuccess) {
        onJoinSuccess(meeting.meetUrl);
      }

      showToast({
        variant: 'success',
        title: 'Meeting Room Ready',
        message: 'Your Google Meet consultation room is open in a new tab.',
        action: {
          label: 'Open Meeting',
          onClick: () => window.open(meeting.meetUrl, '_blank', 'noopener,noreferrer'),
        },
      });

      window.open(meeting.meetUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.warn('[JoinSessionButton] Error opening meeting:', err);
      showToast({
        variant: 'error',
        title: 'Unable to Join Meeting',
        message:
          err?.message ||
          'Unable to join the consultation meeting. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const buttonClasses =
    className ||
    'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#1c202e] text-white text-xs font-semibold hover:bg-[#2c323b] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap';

  return (
    <button
      type="button"
      onClick={handleJoin}
      disabled={loading}
      className={buttonClasses}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {icon || <Video size={14} className="shrink-0" />}
        <span>{loading ? loadingText : buttonText}</span>
      </span>
    </button>
  );
}
