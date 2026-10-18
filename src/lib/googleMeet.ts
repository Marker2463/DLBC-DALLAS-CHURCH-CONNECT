import { google } from 'googleapis';

function getCalendarClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Calendar Service Account environment variables are missing.');
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return google.calendar({ version: 'v3', auth });
}

interface CreateGoogleMeetEventArgs {
  consultationId: string;
  summary: string;
  startTimeIso: string;
  durationMinutes: number;
}

export interface GenerateGoogleMeetLinkArgs {
  summary?: string;
  description?: string;
  startTime?: string;
  durationMinutes?: number;
  consultationId?: string;
  memberEmail?: string | null;
  leaderEmail?: string | null;
}

const FALLBACK_DLBC_CALENDAR_ID = '2244c6b918aa8cd82951682ad0db4d18dfb011a0979e0951a4d43a519bae6e9f@group.calendar.google.com';

export async function generateGoogleMeetLink({
  summary = 'Pastoral Guidance & Consultation',
  description = 'Confidential Pastoral Consultation Session',
  startTime,
  durationMinutes = 45,
  consultationId,
  memberEmail,
  leaderEmail,
}: GenerateGoogleMeetLinkArgs): Promise<{ meetUrl: string; eventId?: string }> {
  const startTimeIso = startTime || new Date().toISOString();
  const endTimeIso = new Date(new Date(startTimeIso).getTime() + durationMinutes * 60000).toISOString();

  const calendar = getCalendarClient();
  const attendees = [
    memberEmail ? { email: memberEmail } : null,
    leaderEmail ? { email: leaderEmail } : null,
  ].filter(Boolean) as { email: string }[];

  const initialCalendarId = process.env.GOOGLE_CALENDAR_ID || FALLBACK_DLBC_CALENDAR_ID;
  const calendarCandidates = [initialCalendarId];
  if (initialCalendarId !== FALLBACK_DLBC_CALENDAR_ID) {
    calendarCandidates.push(FALLBACK_DLBC_CALENDAR_ID);
  }

  let lastError: any = null;

  for (const calId of calendarCandidates) {
    try {
      // First attempt with conference data (hangoutsMeet)
      try {
        const event = await calendar.events.insert({
          calendarId: calId,
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody: {
            summary,
            description,
            start: { dateTime: startTimeIso },
            end: { dateTime: endTimeIso },
            attendees: attendees.length > 0 ? attendees : undefined,
            conferenceData: {
              createRequest: {
                requestId: `meet-${consultationId || Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          },
        });

        const meetUrl = event.data.hangoutLink || event.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
        if (meetUrl) {
          return { meetUrl, eventId: event.data.id || undefined };
        }
      } catch (confErr: any) {
        const confMsg = confErr?.message || '';
        // If conference solution type is invalid on this calendar, retry inserting event without conferenceData
        if (confMsg.includes('Invalid conference type') || confMsg.includes('conferenceData')) {
          console.warn(`[googleMeet.ts] Calendar ${calId} does not support hangoutsMeet directly; inserting event without conference data.`);
          const simpleEvent = await calendar.events.insert({
            calendarId: calId,
            sendUpdates: 'all',
            requestBody: {
              summary,
              description,
              start: { dateTime: startTimeIso },
              end: { dateTime: endTimeIso },
              attendees: attendees.length > 0 ? attendees : undefined,
            },
          });
          return {
            meetUrl: 'https://meet.google.com/new',
            eventId: simpleEvent.data.id || undefined,
          };
        }
        throw confErr;
      }
    } catch (calErr: any) {
      lastError = calErr;
      const msg = (calErr?.response?.data?.error?.message || calErr?.message || '').toLowerCase();
      console.warn(`[googleMeet.ts] Insert failed on calendar ${calId}:`, msg);
      if (msg.includes('writer access') || msg.includes('not found') || msg.includes('forbidden') || msg.includes('permission')) {
        // Continue loop to try next candidate (e.g. FALLBACK_DLBC_CALENDAR_ID)
        continue;
      }
      break;
    }
  }

  console.error('All Google Calendar candidates failed:', lastError);
  const errMsg = (lastError?.response?.data?.error?.message || lastError?.message || '').toLowerCase();
  if (errMsg.includes('writer access') || errMsg.includes('permission') || errMsg.includes('forbidden')) {
    throw new Error('Google Calendar requires writer access. Please grant "Make changes to events" permission so the app can manage calendar events.');
  }
  throw lastError || new Error('Failed to generate Google Meet link.');
}

export async function updateGoogleCalendarEvent({
  eventId,
  startTime,
  durationMinutes = 45,
}: {
  eventId: string;
  startTime: string;
  durationMinutes?: number;
}): Promise<void> {
  const calendar = getCalendarClient();
  const startTimeIso = new Date(startTime).toISOString();
  const endTimeIso = new Date(new Date(startTimeIso).getTime() + durationMinutes * 60000).toISOString();

  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId,
    sendUpdates: 'all',
    requestBody: {
      start: { dateTime: startTimeIso },
      end: { dateTime: endTimeIso },
    },
  });
}

export async function deleteGoogleCalendarEvent({
  eventId,
}: {
  eventId: string;
}): Promise<void> {
  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId,
      sendUpdates: 'all',
    });
  } catch (err: any) {
    console.warn(`[googleMeet] Event deletion skipped or not found for ${eventId}:`, err?.message);
  }
}

export async function createGoogleMeetEvent({
  consultationId,
  summary,
  startTimeIso,
  durationMinutes,
}: CreateGoogleMeetEventArgs): Promise<string> {
  const { meetUrl } = await generateGoogleMeetLink({
    consultationId,
    summary,
    startTime: startTimeIso,
    durationMinutes,
  });
  return meetUrl;
}
