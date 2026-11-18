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

export interface Appointment {
  id: string;

  memberId: string;
  memberName: string;
  memberEmail: string;

  pastorId: string;
  pastorName: string;

  scheduledAt: string;
  durationMinutes: number;

  status:
    | 'scheduled'
    | 'in-progress'
    | 'completed'
    | 'cancelled';

  meetUrl?: string;
  calendarEventId?: string;

  // The actual Google account that created the event
  meetingHostId?: string;
  meetingHostEmail?: string;
  meetingCreatedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Consultation {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  leaderId: string | null;
  leaderName: string | null;
  leaderEmail?: string | null;
  pastorId?: string | null;
  pastorName?: string | null;
  pastorEmail?: string | null;
  category: string;
  urgency: string;
  reason: string;
  attachments: string[];
  selectedTime: string | null; // ISO string
  scheduledAt?: string | null; // ISO string for Appointment compatibility
  durationMinutes?: number;
  originallyRequestedTime?: string | null; // ISO string when rescheduled
  scheduledStart?: string | null; // ISO string
  scheduledEnd?: string | null; // ISO string
  meetingMethod?: 'zoom' | 'google_meet' | 'in_person';
  meetingLocation?: string | null;
  meetingLinkStatus?: 'pending' | 'active' | 'expired';
  meetingLink?: string | null; // Real generated Meet link
  hostMeetingLink?: string | null; // Meeting link with host privileges for pastor/leader
  status: ConsultationStatus;
  isLocked: boolean;
  googleMeetUrl?: string | null;
  googleEventId?: string | null;
  meetUrl?: string | null; // Central shared Google Meet URL
  calendarEventId?: string | null; // Shared Google Calendar Event ID
  meetingHostId?: string | null; // The actual Google account that created the event
  meetingHostEmail?: string | null;
  meetingCreatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  journeyTimeline: ConsultationTimelineItem[];
  cancelledAt?: Timestamp | string | null;
  cancelledBy?: 'member' | 'leader' | null;
  cancellationReason?: string | null;
  meeting?: {
    provider?: 'zoom' | 'google_meet';
    url?: string;
    hostUrl?: string;
    externalId?: string;
    createdAt?: string;
    createdBy?: string;
    status?: string;
  };
}
