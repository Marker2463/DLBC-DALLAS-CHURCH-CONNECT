import { Router, Request, Response, NextFunction } from 'express';
import { google, calendar_v3 } from 'googleapis';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { adminAuth, adminDb } from './firebaseAdmin';
import { createHostedMeeting, configureMeetSpaceOpen } from '../src/server/meet';

const router = Router();

const APPOINTMENTS_COLLECTION =
  process.env.APPOINTMENTS_COLLECTION || 'consultations';

const USERS_COLLECTION = 'users';
const PRIVATE_GOOGLE_COLLECTION = '_privateGoogleOAuth';
const OAUTH_STATES_COLLECTION = 'googleOAuthStates';

const CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.events';
const MEET_SPACE_SCOPE =
  'https://www.googleapis.com/auth/meetings.space.settings';

type UserRole = 'member' | 'leader' | 'pastor' | 'admin';

interface AuthenticatedRequest extends Request {
  firebaseUid?: string;
  firebaseEmail?: string;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
}

interface AppointmentRecord {
  id?: string;
  memberId: string;
  memberEmail?: string;
  memberName?: string;
  pastorId?: string;
  pastorName?: string;
  leaderId?: string;
  leaderName?: string;
  scheduledAt?: string;
  scheduledStart?: string;
  selectedTime?: string;
  durationMinutes?: number;
  meetUrl?: string;
  googleMeetUrl?: string;
  meetingLink?: string;
  hostMeetingLink?: string;
  calendarEventId?: string;
  googleEventId?: string;
  meetingHostId?: string;
  meetingHostEmail?: string;
  meetingCreatedAt?: string;
  status?: string;
}

function getAppWebUrl(): string {
  return process.env.APP_WEB_URL || process.env.APP_URL || 'http://localhost:3000';
}

function getRedirectUri(): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  return `${getAppWebUrl()}/api/google/oauth/callback`;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function oauthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth credentials are missing. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET on the server.'
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri()
  );
}

/* -------------------------------------------------------
   Encrypt Google refresh tokens before storing in Firestore
------------------------------------------------------- */

function encryptionKey(): Buffer {
  const keyStr =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
    'qxx3E5aaHjUFM7nhrZz0BYhVqkvtoGisfZ4ZknA/eN4=';

  const key = Buffer.from(keyStr, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'GOOGLE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.'
    );
  }

  return key;
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptToken(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split('.');

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Stored Google authorization is invalid.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/* -------------------------------------------------------
   Firebase authentication middleware
------------------------------------------------------- */

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/i);

    if (!match) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    const decoded = await adminAuth.verifyIdToken(match[1]);

    req.firebaseUid = decoded.uid;
    req.firebaseEmail = decoded.email
      ? normalizeEmail(decoded.email)
      : undefined;

    next();
  } catch (authErr: any) {
    console.warn('[googleMeetRoutes] verifyIdToken failed:', authErr?.message);
    return res.status(401).json({
      message: 'Your session is invalid or expired. Sign in again.',
    });
  }
}

async function loadUserProfile(uid: string): Promise<UserProfile> {
  const snapshot = await adminDb
    .collection(USERS_COLLECTION)
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    throw new Error('USER_PROFILE_NOT_FOUND');
  }

  return snapshot.data() as UserProfile;
}

async function requireLeader(uid: string): Promise<UserProfile> {
  const profile = await loadUserProfile(uid);

  if (profile.role !== 'pastor' && profile.role !== 'leader' && (profile.role as any) !== 'admin') {
    throw new Error('LEADER_ACCOUNT_REQUIRED');
  }

  return profile;
}

/* -------------------------------------------------------
   Status route: Check if pastor's Google Calendar is connected
   GET /api/google/oauth/status
------------------------------------------------------- */

router.get(
  '/google/oauth/status',
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.firebaseUid!;
      const tokenSnapshot = await adminDb
        .collection(PRIVATE_GOOGLE_COLLECTION)
        .doc(uid)
        .get();

      if (!tokenSnapshot.exists) {
        return res.json({ connected: false });
      }

      const data = tokenSnapshot.data()!;
      return res.json({
        connected: Boolean(data.encryptedRefreshToken),
        email: data.email || null,
        connectedAt: data.connectedAt || null,
      });
    } catch (error: any) {
      console.error('[Google OAuth status error]', error.message || error);
      return res.status(500).json({ connected: false, message: error.message });
    }
  }
);

/* -------------------------------------------------------
   1. Leader connects their own personal Google account

   POST /api/google/oauth/start
------------------------------------------------------- */

router.post(
  '/google/oauth/start',
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.firebaseUid!;
      await requireLeader(uid);

      const state = randomBytes(32).toString('hex');

      await adminDb
        .collection(OAUTH_STATES_COLLECTION)
        .doc(state)
        .create({
          uid,
          createdAt: Date.now(),
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

      const client = oauthClient();

      const authorizationUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: [
          'openid',
          'email',
          CALENDAR_SCOPE,
          MEET_SPACE_SCOPE,
        ],
        state,
      });

      return res.json({ authorizationUrl });
    } catch (error: any) {
      console.error('[Google OAuth start error]', error.message || error);
      const isMissingEnv = error.message?.includes('credentials are missing');
      const isLeaderReq = error.message === 'LEADER_ACCOUNT_REQUIRED';

      let message = 'Unable to start Google Calendar authorization.';
      let statusCode = 500;

      if (isLeaderReq) {
        message = 'Only an approved pastor or leader can connect a calendar.';
        statusCode = 403;
      } else if (isMissingEnv) {
        message = error.message;
        statusCode = 503;
      }

      return res.status(statusCode).json({ message });
    }
  }
);

/* -------------------------------------------------------
   2. Google redirects here after the leader gives consent

   GET /api/google/oauth/callback
------------------------------------------------------- */

router.get(
  '/google/oauth/callback',
  async (req: Request, res: Response) => {
    const appUrl = getAppWebUrl();

    try {
      const code = String(req.query.code || '');
      const state = String(req.query.state || '');

      if (!code || !/^[a-f0-9]{64}$/i.test(state)) {
        return res.redirect(
          `${appUrl}/settings?googleCalendar=error`
        );
      }

      const stateRef = adminDb
        .collection(OAUTH_STATES_COLLECTION)
        .doc(state);

      // Consume the state once, atomically. This prevents replay.
      const stateData = await adminDb.runTransaction(async (tx) => {
        const snapshot = await tx.get(stateRef);

        if (!snapshot.exists) {
          throw new Error('OAUTH_STATE_INVALID');
        }

        const data = snapshot.data()!;

        if (data.expiresAt < Date.now()) {
          tx.delete(stateRef);
          throw new Error('OAUTH_STATE_EXPIRED');
        }

        tx.delete(stateRef);
        return data;
      });

      const uid = String(stateData.uid);
      const profile = await requireLeader(uid);

      const client = oauthClient();
      const { tokens } = await client.getToken(code);

      client.setCredentials(tokens);

      const googleUser = await client.request<{
        email?: string;
        verified_email?: boolean;
      }>({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });

      const googleEmail = normalizeEmail(
        googleUser.data.email || ''
      );

      if (!googleEmail || googleUser.data.verified_email !== true) {
        throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
      }

      // Require the calendar account to match the leader's registered email.
      if (googleEmail !== normalizeEmail(profile.email)) {
        throw new Error('GOOGLE_ACCOUNT_EMAIL_MISMATCH');
      }

      const tokenRef = adminDb
        .collection(PRIVATE_GOOGLE_COLLECTION)
        .doc(uid);

      const oldToken = await tokenRef.get();

      let refreshToken = tokens.refresh_token;

      // Google may not return a new refresh token on every authorization.
      if (!refreshToken && oldToken.exists) {
        const oldData = oldToken.data()!;

        if (oldData.email === googleEmail && oldData.encryptedRefreshToken) {
          refreshToken = decryptToken(
            oldData.encryptedRefreshToken
          );
        }
      }

      if (!refreshToken) {
        throw new Error('GOOGLE_REFRESH_TOKEN_MISSING');
      }

      await tokenRef.set({
        uid,
        email: googleEmail,
        encryptedRefreshToken: encryptToken(refreshToken),
        connectedAt: new Date().toISOString(),
        scopes: ['openid', 'email', CALENDAR_SCOPE],
      });

      return res.redirect(
        `${appUrl}/settings?googleCalendar=connected`
      );
    } catch (error: any) {
      console.error('[Google OAuth callback]', error.message || error);

      let reason = 'authorization-failed';
      if (error.message === 'GOOGLE_ACCOUNT_EMAIL_MISMATCH') {
        reason = 'wrong-account';
      } else if (error.message === 'GOOGLE_REFRESH_TOKEN_MISSING') {
        reason = 'refresh-token-missing';
      }

      return res.redirect(
        `${appUrl}/settings?googleCalendar=${reason}`
      );
    }
  }
);

/* -------------------------------------------------------
   Calendar event helpers
------------------------------------------------------- */

export function extractMeetUrl(
  event: calendar_v3.Schema$Event
): string | null {
  const candidate =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video'
    )?.uri;

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'meet.google.com' ||
      parsed.pathname === '/new'
    ) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

export function getMeetingEventId(
  consultationId: string,
  pastorId: string
): string {
  // Calendar accepts client-generated event IDs using base32hex
  // characters. A hexadecimal digest is safe for this purpose.
  return createHash('sha256')
    .update(`dlbc:${consultationId}:${pastorId}`)
    .digest('hex')
    .slice(0, 40);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createOrRetrieveCalendarMeeting(args: {
  consultationId: string;
  pastorId: string;
  pastorEmail: string;
  memberName?: string;
  scheduledAt: string;
  durationMinutes: number;
  encryptedRefreshToken: string;
}): Promise<{ meetUrl: string; eventId: string }> {
  const {
    consultationId,
    pastorId,
    pastorEmail,
    memberName,
    scheduledAt,
    durationMinutes,
    encryptedRefreshToken,
  } = args;

  const start = new Date(scheduledAt);

  if (Number.isNaN(start.getTime())) {
    throw new Error('CONSULTATION_DATE_INVALID');
  }

  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
    throw new Error('CONSULTATION_DURATION_INVALID');
  }

  const end = new Date(
    start.getTime() + durationMinutes * 60_000
  );

  const client = oauthClient();

  client.setCredentials({
    refresh_token: decryptToken(encryptedRefreshToken),
  });

  const calendar = google.calendar({
    version: 'v3',
    auth: client,
  });

  const eventId = getMeetingEventId(
    consultationId,
    pastorId
  );

  let event: calendar_v3.Schema$Event;

  try {
    const result = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        id: eventId,
        summary: 'Pastoral Consultation',
        description:
          `DLBC consultation ${consultationId}\n` +
          `Member: ${memberName || 'Church member'}`,
        start: {
          dateTime: start.toISOString(),
        },
        end: {
          dateTime: end.toISOString(),
        },
        visibility: 'private',
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        conferenceData: {
          createRequest: {
            requestId: `dlbc-${eventId}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },

        // INTENTIONALLY NO ATTENDEES.
        // The member receives the URL from Firestore, not a Calendar invite.
        // This ensures the member is an uninvited participant who must
        // request admission under the personal-account meeting behavior.
      },
    });

    event = result.data;
  } catch (error: any) {
    const status = error?.response?.status || error?.code;

    if (Number(status) !== 409) {
      throw error;
    }

    // A previous request may already have created this event.
    // Retrieve it instead of creating another meeting.
    const existing = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    event = existing.data;
  }

  // Google may take a short time to generate the Meet conference.
  for (let attempt = 0; attempt < 8; attempt++) {
    const organizerEmail = normalizeEmail(
      event.organizer?.email || event.creator?.email || ''
    );

    if (organizerEmail && organizerEmail !== normalizeEmail(pastorEmail)) {
      throw new Error('CALENDAR_ORGANIZER_MISMATCH');
    }

    const meetUrl = extractMeetUrl(event);

    if (meetUrl) {
      try {
        await configureMeetSpaceOpen(client, meetUrl);
      } catch (spaceErr: any) {
        console.warn('[googleMeetRoutes] Unable to patch personal Meet space accessType to OPEN:', spaceErr?.message || spaceErr);
      }
      return {
        meetUrl,
        eventId,
      };
    }

    const conferenceStatus =
      event.conferenceData?.createRequest?.status?.statusCode;

    if (conferenceStatus === 'failure') {
      throw new Error('GOOGLE_CONFERENCE_CREATION_FAILED');
    }

    await sleep(1200);

    const refreshed = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    event = refreshed.data;
  }

  // Do not return meet.google.com/new or a made-up URL.
  throw new Error('GOOGLE_MEET_LINK_NOT_READY');
}

/* -------------------------------------------------------
   3. One endpoint for both pastor and member

   POST /api/consultations/:consultationId/meeting

   The first request creates the meeting under the pastor.
   Later requests return the exact same Firestore-stored URL.
------------------------------------------------------- */

router.post(
  '/consultations/:consultationId/meeting',
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uid = req.firebaseUid!;
      const consultationId = req.params.consultationId;

      if (!consultationId) {
        return res.status(400).json({
          message: 'Consultation ID is required.',
        });
      }

      // Look up in primary collection, with fallback to 'consultations' if needed
      let appointmentRef = adminDb
        .collection(APPOINTMENTS_COLLECTION)
        .doc(consultationId);

      let appointmentSnapshot = await appointmentRef.get();

      if (!appointmentSnapshot.exists && APPOINTMENTS_COLLECTION !== 'consultations') {
        appointmentRef = adminDb.collection('consultations').doc(consultationId);
        appointmentSnapshot = await appointmentRef.get();
      }

      if (!appointmentSnapshot.exists) {
        return res.status(404).json({
          message: 'Consultation not found.',
        });
      }

      const appointment =
        appointmentSnapshot.data() as AppointmentRecord;

      const pastorId = appointment.pastorId || appointment.leaderId;
      const memberId = appointment.memberId;
      const scheduledAt = appointment.scheduledAt || appointment.scheduledStart || appointment.selectedTime;

      const isMember = memberId === uid;
      const isAssignedPastor = pastorId === uid;

      if (!isMember && !isAssignedPastor) {
        // Also check if caller is an admin
        let isAdminUser = false;
        try {
          const callerProfile = await loadUserProfile(uid);
          isAdminUser = callerProfile.role === 'admin';
        } catch {
          isAdminUser = false;
        }

        if (!isAdminUser) {
          return res.status(403).json({
            message: 'You are not assigned to this consultation.',
          });
        }
      }

      if (!pastorId || !memberId || !scheduledAt) {
        return res.status(400).json({
          message: 'The consultation is missing required details.',
        });
      }

      const pastor = await loadUserProfile(pastorId);

      if (pastor.role !== 'pastor' && pastor.role !== 'leader' && (pastor.role as any) !== 'admin') {
        return res.status(409).json({
          message: 'The assigned pastor or leader account is not valid.',
        });
      }

      const pastorEmail = normalizeEmail(pastor.email || '');

      if (!pastorEmail) {
        return res.status(409).json({
          message: 'The assigned pastor has no registered email.',
        });
      }

      // Return the saved URL if a valid Meet link and event ID already exist.
      const existingUrl = appointment.meetUrl || appointment.googleMeetUrl || appointment.meetingLink;

      if (
        existingUrl &&
        appointment.calendarEventId &&
        extractMeetUrl({ hangoutLink: existingUrl })
      ) {
        return res.json({
          meetUrl: existingUrl,
          eventId: appointment.calendarEventId,
          meetingHostEmail: appointment.meetingHostEmail || pastorEmail,
          reused: true,
        });
      }

      // Attempt assigned pastor's personal OAuth credentials first; fall back seamlessly to central pastoral office credentials.
      const tokenSnapshot = await adminDb
        .collection(PRIVATE_GOOGLE_COLLECTION)
        .doc(pastorId)
        .get();

      const tokenData = tokenSnapshot.exists ? tokenSnapshot.data() : null;
      const hasPersonalToken =
        Boolean(tokenData?.encryptedRefreshToken) &&
        normalizeEmail(tokenData?.email || '') === pastorEmail;

      let meeting: { meetUrl: string; eventId: string };
      let resolvedHostEmail = pastorEmail;

      if (hasPersonalToken && tokenData?.encryptedRefreshToken) {
        meeting = await createOrRetrieveCalendarMeeting({
          consultationId,
          pastorId,
          pastorEmail,
          memberName: appointment.memberName,
          scheduledAt,
          durationMinutes: appointment.durationMinutes || 45,
          encryptedRefreshToken: tokenData.encryptedRefreshToken,
        });
      } else {
        const startDate = new Date(scheduledAt);
        if (Number.isNaN(startDate.getTime())) {
          throw new Error('CONSULTATION_DATE_INVALID');
        }
        const durationMinutes = appointment.durationMinutes || 45;
        if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
          throw new Error('CONSULTATION_DURATION_INVALID');
        }
        const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

        const hosted = await createHostedMeeting({
          consultationId,
          leaderUid: pastorId,
          startIso: startDate.toISOString(),
          endIso: endDate.toISOString(),
          memberEmail: appointment.memberEmail,
          leaderName: pastor.displayName || appointment.pastorName || appointment.leaderName || 'Pastoral Leader',
          memberName: appointment.memberName || 'Church member',
        });

        meeting = { meetUrl: hosted.meetUrl, eventId: hosted.eventId };
        resolvedHostEmail = hosted.hostEmail;
      }

      const now = new Date().toISOString();

      await appointmentRef.update({
        meetUrl: meeting.meetUrl,
        googleMeetUrl: meeting.meetUrl,
        meetingLink: meeting.meetUrl,
        hostMeetingLink: meeting.meetUrl,
        calendarEventId: meeting.eventId,
        googleEventId: meeting.eventId,
        meetingHostId: pastorId,
        meetingHostEmail: resolvedHostEmail,
        meetingCreatedAt: now,
        meetingLinkStatus: 'active',
        meeting: {
          provider: 'google_meet',
          url: meeting.meetUrl,
          hostUrl: meeting.meetUrl,
          externalId: meeting.eventId,
          createdAt: now,
          createdBy: uid,
          status: 'active',
        },
        updatedAt: now,
      });

      return res.json({
        meetUrl: meeting.meetUrl,
        eventId: meeting.eventId,
        meetingHostEmail: resolvedHostEmail,
        reused: false,
      });
    } catch (error: any) {
      console.error(
        '[Consultation meeting endpoint]',
        error?.response?.data || error?.message || error
      );

      if (error.message === 'CALENDAR_ORGANIZER_MISMATCH') {
        return res.status(409).json({
          message:
            'Google Calendar returned an event with the wrong organizer. No meeting link was saved.',
        });
      }

      if (error.message === 'GOOGLE_MEET_LINK_NOT_READY') {
        return res.status(503).json({
          message:
            'Google has not finished creating the meeting link. Please retry.',
        });
      }

      if (error.message === 'GOOGLE_CONFERENCE_CREATION_FAILED') {
        return res.status(503).json({
          message:
            'Google could not create the video conference. Please reconnect the pastor account and retry.',
        });
      }

      if (error.message === 'CONSULTATION_DATE_INVALID') {
        return res.status(400).json({
          message: 'The consultation date is invalid.',
        });
      }

      if (error.message === 'CONSULTATION_DURATION_INVALID') {
        return res.status(400).json({
          message: 'The consultation duration is invalid.',
        });
      }

      return res.status(500).json({
        message: error?.message || 'Unable to create or retrieve the consultation meeting.',
      });
    }
  }
);

export default router;
