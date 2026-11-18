import { google } from 'googleapis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAdminFirestore } from './firebaseAdmin';

type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/**
 * Derives or loads a 32-byte key for AES-256-GCM encryption of stored refresh tokens.
 * Priority:
 * 1. GOOGLE_TOKEN_ENC_KEY env var (hex or base64 or sha256 derived)
 * 2. Locally generated key in runtime file (.runtime_token_enc.key)
 */
export function getEncryptionKey(): Buffer {
  if (process.env.GOOGLE_TOKEN_ENC_KEY) {
    const raw = process.env.GOOGLE_TOKEN_ENC_KEY.trim();
    if (raw.length === 64) {
      return Buffer.from(raw, 'hex');
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
    return crypto.createHash('sha256').update(raw).digest();
  }

  const keyPath = path.resolve(process.cwd(), '.runtime_token_enc.key');
  if (fs.existsSync(keyPath)) {
    try {
      const existing = fs.readFileSync(keyPath);
      if (existing.length === 32) return existing;
    } catch {}
  }

  const generated = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyPath, generated, { mode: 0o600 });
  } catch {}
  return generated;
}

export function encryptToken(token: string): { refreshTokenEnc: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    refreshTokenEnc: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

export function decryptToken(enc: { refreshTokenEnc: string; iv: string; tag: string }): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
  let decrypted = decipher.update(enc.refreshTokenEnc, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface CreateHostedMeetingArgs {
  consultationId: string;
  leaderUid: string;
  startIso: string;
  endIso: string;
  memberEmail?: string | null;
  category?: string;
  leaderName?: string;
  memberName?: string;
}

export interface HostedMeetingResult {
  meetUrl: string;
  eventId: string;
  hostEmail: string;
}

export interface HostOAuthClientResult {
  oauth2Client: GoogleOAuth2Client;
  hostEmail: string;
  usedCentralFallback: boolean;
}

const MEET_URL_REGEX = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

/**
 * Resolves the central pastoral office Google OAuth2 client from environment credentials
 * (`GOOGLE_OAUTH_REFRESH_TOKEN` and `GOOGLE_MEET_ORGANIZER_EMAIL`).
 */
export async function getCentralPastoralOAuth2Client(): Promise<HostOAuthClientResult> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const centralRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const pastoralOfficeEmail = (process.env.GOOGLE_MEET_ORGANIZER_EMAIL || '').toLowerCase().trim();

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET) are missing.');
  }

  if (!centralRefreshToken) {
    throw new Error(
      'Central pastoral office credentials (GOOGLE_OAUTH_REFRESH_TOKEN) are not configured on the server.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: centralRefreshToken });

  let hostEmail = pastoralOfficeEmail;
  if (!hostEmail) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const primaryCal = await calendar.calendars.get({ calendarId: 'primary' });
      hostEmail = (primaryCal.data.id || '').toLowerCase().trim();
    } catch (calErr: any) {
      console.warn('[meet.ts] Unable to read primary calendar email for central office token:', calErr?.message || calErr);
    }
  }

  return {
    oauth2Client,
    hostEmail: hostEmail || 'pastoral-office@dlbc.org',
    usedCentralFallback: true,
  };
}

/**
 * Resolves the Google OAuth2 client authenticated as the consultation host.
 * 1. Uses the individual pastor/leader's linked OAuth credentials from `leaderGoogleAuth/{leaderUid}` if present and valid.
 * 2. Seamlessly falls back to the central pastoral office credentials (`GOOGLE_OAUTH_REFRESH_TOKEN` and
 *    `GOOGLE_MEET_ORGANIZER_EMAIL`) if the leader has not completed personal OAuth linking or lacks valid tokens.
 */
export async function getHostOAuth2Client(leaderUid: string): Promise<HostOAuthClientResult> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET) are missing.');
  }

  // 1. Attempt individual leader OAuth credentials if leaderUid is provided
  if (leaderUid) {
    try {
      const firestore = getAdminFirestore();
      const authDoc = await firestore.collection('leaderGoogleAuth').doc(leaderUid).get();

      if (authDoc.exists) {
        const authData = authDoc.data() || {};
        if (authData.refreshTokenEnc && authData.iv && authData.tag && authData.email) {
          const refreshToken = decryptToken({
            refreshTokenEnc: authData.refreshTokenEnc,
            iv: authData.iv,
            tag: authData.tag,
          });

          if (refreshToken && refreshToken.trim().length > 0) {
            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            return {
              oauth2Client,
              hostEmail: String(authData.email).toLowerCase().trim(),
              usedCentralFallback: false,
            };
          }
        }
      }
    } catch (err: any) {
      console.warn(
        `[meet.ts] Personal OAuth lookup/decryption unavailable for leader ${leaderUid}; falling back to central pastoral office credentials:`,
        err?.message || err
      );
    }
  }

  // 2. Seamless fallback to central pastoral office credentials
  return getCentralPastoralOAuth2Client();
}

/**
 * Configures the Google Meet space `accessType` to `OPEN` using the host OAuth2 client
 * so congregants and leaders enter the consultation room directly without knocking.
 */
export async function configureMeetSpaceOpen(
  oauth2Client: GoogleOAuth2Client,
  meetUrl: string
): Promise<void> {
  const meetingCodeMatch = meetUrl.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  if (!meetingCodeMatch) {
    throw new Error(`Invalid meeting code format in meet URL: ${meetUrl}`);
  }
  const meetingCode = meetingCodeMatch[1].toLowerCase();

  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!accessToken) {
    throw new Error('Could not acquire access token to configure Google Meet space.');
  }

  const spaceLookupRes = await fetch(`https://meet.googleapis.com/v2/spaces/${meetingCode}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!spaceLookupRes.ok) {
    const errText = await spaceLookupRes.text();
    throw new Error(`Failed to retrieve Meet space for code ${meetingCode} (${spaceLookupRes.status}): ${errText}`);
  }

  const spaceData: any = await spaceLookupRes.json();
  const spaceName = spaceData.name; // e.g. "spaces/123456"
  if (!spaceName) {
    throw new Error(`Meet space resource name missing for code ${meetingCode}`);
  }

  const patchRes = await fetch(`https://meet.googleapis.com/v2/${spaceName}?updateMask=config.accessType`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      config: {
        accessType: 'OPEN',
      },
    }),
  });

  if (!patchRes.ok) {
    const patchErrText = await patchRes.text();
    throw new Error(`Failed to configure Meet space accessType to OPEN (${patchRes.status}): ${patchErrText}`);
  }
}

/**
 * Creates the calendar event on the primary calendar associated with the resolved
 * host OAuth2 client (personal leader account or central pastoral office fallback)
 * and sets the Google Meet space `accessType` to `OPEN` so members join directly.
 */
export async function createHostedMeeting({
  consultationId,
  leaderUid,
  startIso,
  endIso,
  memberEmail,
  category = 'Spiritual Guidance',
  leaderName = 'Pastoral Leader',
  memberName = 'Member',
}: CreateHostedMeetingArgs): Promise<HostedMeetingResult> {
  const { oauth2Client, hostEmail } = await getHostOAuth2Client(leaderUid);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const cleanMemberEmail = memberEmail ? memberEmail.toLowerCase().trim() : null;

  // Attendees list: member ONLY (pastor/office is organizer via primary calendar authentication)
  const attendees: { email: string }[] = [];
  if (cleanMemberEmail) {
    attendees.push({ email: cleanMemberEmail });
  }

  const requestId = `meet-${consultationId}-${Date.now()}`;

  const insertRes = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: `Pastoral Consultation — ${category}`,
      description: `Confidential pastoral consultation session.\nHost: ${leaderName} (${hostEmail})\nMember: ${memberName}${cleanMemberEmail ? ` (${cleanMemberEmail})` : ''}\nConsultation ID: ${consultationId}`,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      attendees: attendees.length > 0 ? attendees : undefined,
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  let event = insertRes.data;
  let meetUrl = event.hangoutLink || event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;

  // Poll the event up to 5 times for the conference URI if not returned immediately
  if (!meetUrl && event.id) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const polled = await calendar.events.get({
        calendarId: 'primary',
        eventId: event.id,
      });
      meetUrl = polled.data.hangoutLink || polled.data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
      if (meetUrl) {
        event = polled.data;
        break;
      }
    }
  }

  if (!meetUrl || !MEET_URL_REGEX.test(meetUrl)) {
    throw new Error(`Google Calendar did not return a valid conference URI: ${meetUrl || 'none'}`);
  }

  // Configure Google Meet space accessType to OPEN so members enter directly without knocking
  await configureMeetSpaceOpen(oauth2Client, meetUrl);

  return {
    meetUrl,
    eventId: event.id!,
    hostEmail,
  };
}

/**
 * Deletes a scheduled calendar event on the host's primary calendar (best effort)
 */
export async function deleteHostedCalendarEvent(leaderUid: string, eventId: string): Promise<void> {
  try {
    const { oauth2Client } = await getHostOAuth2Client(leaderUid);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all',
    });
  } catch (err: any) {
    console.warn(`[meet.ts] Failed to delete calendar event ${eventId} (best effort):`, err?.message || err);
  }
}
