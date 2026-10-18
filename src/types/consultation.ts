import type { Timestamp } from 'firebase/firestore';

export const CONSULTATION_STATUSES = [
  'submitted',
  'under_review',
  'scheduled',
  'completed',
  'archived',
  'cancelled',
] as const;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export interface ConsultationNote {
  id: string;
  consultationId: string;
  authorId: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

export interface ConsultationTimelineItem {
  status: string;
  timestamp: string;
  description: string;
}

export interface Consultation {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  leaderId: string | null;
  leaderName: string | null;
  leaderEmail?: string | null;
  category: string;
  urgency: string;
  reason: string;
  attachments: string[];
  selectedTime: string | null; // ISO string
  scheduledStart?: string | null; // ISO string
  scheduledEnd?: string | null; // ISO string
  meetingMethod?: 'zoom' | 'google_meet' | 'in_person';
  meetingLocation?: string | null;
  meetingLinkStatus?: 'pending' | 'active' | 'expired';
  meetingLink?: string | null; // Real generated Meet link
  status: ConsultationStatus;
  isLocked: boolean;
  googleMeetUrl?: string | null;
  googleEventId?: string | null;
  meetUrl?: string | null; // Central shared Google Meet URL
  calendarEventId?: string | null; // Shared Google Calendar Event ID
  createdAt?: string | null;
  updatedAt?: string | null;
  journeyTimeline: ConsultationTimelineItem[];
  cancelledAt?: Timestamp | string | null;
  cancelledBy?: 'member' | 'leader' | null;
  cancellationReason?: string | null;
  meeting?: {
    provider?: 'zoom' | 'google_meet';
    url?: string;
    externalId?: string;
    createdAt?: string;
    createdBy?: string;
    status?: string;
  };
}
