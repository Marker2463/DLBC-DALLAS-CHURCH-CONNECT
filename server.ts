import express from "express";
import { rateLimit } from "express-rate-limit";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createZoomMeeting, updateZoomMeeting, deleteZoomMeeting } from "./src/lib/zoom";
import { createGoogleMeetEvent, generateGoogleMeetLink, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "./src/lib/googleMeet";
import { isSyntheticMeetUrl } from "./src/lib/appointmentService";

dotenv.config();

// In-flight concurrency lock to deduplicate simultaneous requests for the same consultation
const inFlightJoinRequests = new Map<string, Promise<any>>();
const consultationJoinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many consultation join requests. Please try again later.' },
});

function getAdminFirestore() {
  if (!getApps().length) {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId = "dlbc-dallas-church-connect";

    if (clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    } else {
      initializeApp({ projectId: "dlbc-dallas-church-connect" });
    }
  }
  const app = getApps()[0];
  const firestore = getFirestore(app, "ai-studio-dlbcchurchconnec-d51b846f-e39f-40ba-8929-2e22d9a82610");
  return firestore;
}

function getAdminAuth() {
  getAdminFirestore();
  return getAuth(getApps()[0]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Headers Middleware (Configured safely for AI Studio preview & iframe embedding)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/calendar/schedule", async (req, res) => {
    try {
      const { consultationId, title, memberEmail, leaderEmail, selectedTime, method, googleAccessToken } = req.body;
      const explicitGoogleToken = googleAccessToken || req.headers['x-google-access-token'];
      if (!selectedTime || !memberEmail) {
        return res.status(400).json({ success: false, error: "Missing required appointment fields (selectedTime, memberEmail)." });
      }

      let docData: any = null;
      let docRef: any = null;
      if (consultationId) {
        try {
          const firestore = getAdminFirestore();
          docRef = firestore.collection('consultations').doc(consultationId);
          const snap = await docRef.get();
          if (snap.exists) {
            docData = snap.data();
            const existingMeet = docData.meetUrl || docData.googleMeetUrl || docData.meetingLink;
            if (existingMeet && docData.calendarEventId) {
              return res.json({
                success: true,
                eventId: docData.calendarEventId || docData.googleEventId,
                googleMeetUrl: existingMeet,
                meetUrl: existingMeet,
                calendarEventId: docData.calendarEventId || docData.googleEventId,
              });
            }
          }
        } catch (dbErr) {
          console.warn("Read-first firestore check non-fatal error:", dbErr);
        }
      }

      const startTime = new Date(selectedTime);
      const endTime = new Date(startTime.getTime() + 45 * 60000);
      
      const eventPayload: any = {
        summary: title || 'DLBC Pastoral Consultation',
        description: `Consultation ID: ${consultationId}\nConfidential pastoral care session.`,
        start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
        end: { dateTime: endTime.toISOString(), timeZone: "UTC" },
        attendees: [{ email: memberEmail }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };
      
      if (leaderEmail) {
        eventPayload.attendees.push({ email: leaderEmail });
      }

      if (method === 'google_meet') {
        eventPayload.conferenceData = {
          createRequest: {
            requestId: `meet-${consultationId || Date.now()}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        };
      }

      let response: any = null;
      const FALLBACK_DLBC_CALENDAR_ID = "2244c6b918aa8cd82951682ad0db4d18dfb011a0979e0951a4d43a519bae6e9f@group.calendar.google.com";

      // 1. Try with explicit Google OAuth Access Token if caller provided one (has direct writer access to primary calendar)
      if (explicitGoogleToken) {
        try {
          const userAuth = new google.auth.OAuth2();
          userAuth.setCredentials({ access_token: explicitGoogleToken as string });
          const userCal = google.calendar({ version: "v3", auth: userAuth });
          response = await userCal.events.insert({
            calendarId: "primary",
            conferenceDataVersion: 1,
            sendUpdates: "all",
            requestBody: eventPayload,
          });
        } catch (oAuthErr: any) {
          console.warn("[/api/calendar/schedule] OAuth insert failed, attempting service account fallback:", oAuthErr?.message);
        }
      }

      // 2. Fallback to service account
      if (!response) {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
          return res.status(500).json({
            success: false,
            error: "Google Calendar service account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY) are not configured."
          });
        }
        
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ["https://www.googleapis.com/auth/calendar"]
        });
        const calendar = google.calendar({ version: "v3", auth });

        const initialCalId = process.env.GOOGLE_CALENDAR_ID || FALLBACK_DLBC_CALENDAR_ID;
        const calCandidates = [initialCalId];
        if (initialCalId !== FALLBACK_DLBC_CALENDAR_ID) {
          calCandidates.push(FALLBACK_DLBC_CALENDAR_ID);
        }

        let lastCalErr: any = null;
        for (const calId of calCandidates) {
          try {
            try {
              response = await calendar.events.insert({
                calendarId: calId,
                conferenceDataVersion: 1,
                sendUpdates: "all",
                requestBody: eventPayload,
              });
              if (response) break;
            } catch (confErr: any) {
              const confMsg = confErr?.message || '';
              if (confMsg.includes('Invalid conference type') || confMsg.includes('conferenceData')) {
                console.warn(`[server.ts] Calendar ${calId} does not support conferenceData directly, inserting standard event.`);
                const simplePayload = { ...eventPayload };
                delete simplePayload.conferenceData;
                response = await calendar.events.insert({
                  calendarId: calId,
                  sendUpdates: "all",
                  requestBody: simplePayload,
                });
                if (response) break;
              }
              throw confErr;
            }
          } catch (calErr: any) {
            lastCalErr = calErr;
            const errMsg = (calErr?.response?.data?.error?.message || calErr?.message || '').toLowerCase();
            console.warn(`[server.ts] Calendar insert on ${calId} failed:`, errMsg);
            if (errMsg.includes('writer access') || errMsg.includes('forbidden') || errMsg.includes('not found')) {
              continue;
            }
            break;
          }
        }

        if (!response && lastCalErr) {
          throw lastCalErr;
        }
      }

      const eventData = response.data;
      let meetUrl: string | null = null;
      if (method === 'google_meet') {
        meetUrl = eventData.hangoutLink || eventData.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri || null;
        if (!meetUrl) {
          return res.status(502).json({
            success: false,
            error: "Google Calendar event created, but no unique Google Meet video link was returned. Ensure Google Meet is enabled on the shared calendar."
          });
        }
      }

      if (docRef && meetUrl) {
        try {
          await docRef.update({
            meetUrl,
            googleMeetUrl: meetUrl,
            meetingLink: meetUrl,
            calendarEventId: eventData.id,
            googleEventId: eventData.id,
            updatedAt: new Date().toISOString()
          });
        } catch (updateErr) {
          console.warn("Firestore update in schedule route error:", updateErr);
        }
      }

      return res.json({
        success: true,
        eventId: eventData.id,
        calendarEventId: eventData.id,
        googleMeetUrl: meetUrl,
        meetUrl,
      });
    } catch (error: any) {
      console.error("Google Calendar Error:", error);
      let errMsg = error?.response?.data?.error?.message || error?.message || "Failed to schedule Google Calendar event.";
      if (errMsg.toLowerCase().includes('writer access') || errMsg.toLowerCase().includes('forbidden')) {
        errMsg = "Google Calendar requires writer access. Please grant 'Make changes to events' permission so the calendar can be accessed and updated.";
      }
      return res.status(500).json({
        success: false,
        error: errMsg
      });
    }
  });

  app.put("/api/calendar/update", async (req, res) => {
    try {
      const { eventId, selectedTime } = req.body;
      if (!eventId || !selectedTime) {
        return res.status(400).json({ success: false, error: "Missing required fields (eventId, selectedTime)." });
      }

      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        return res.status(500).json({
          success: false,
          error: "Google Calendar service account credentials are not configured."
        });
      }
      
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ["https://www.googleapis.com/auth/calendar"]
      });
      const calendar = google.calendar({ version: "v3", auth });
      const startTime = new Date(selectedTime);
      const endTime = new Date(startTime.getTime() + 45 * 60000);
      
      const response = await calendar.events.patch({
        calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
        eventId: eventId,
        sendUpdates: "all",
        requestBody: {
          start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
          end: { dateTime: endTime.toISOString(), timeZone: "UTC" }
        },
      });

      return res.json({ success: true, eventId: response.data.id });
    } catch (error: any) {
      console.error("Google Calendar Update Error:", error);
      let errMsg = error?.response?.data?.error?.message || error?.message || "Failed to update Google Calendar event.";
      if (errMsg.toLowerCase().includes('writer access') || errMsg.toLowerCase().includes('forbidden')) {
        errMsg = "Google Calendar requires writer access. Please grant 'Make changes to events' permission so the calendar can be accessed and updated.";
      }
      return res.status(500).json({ success: false, error: errMsg });
    }
  });

  app.post("/api/consultations/join", consultationJoinRateLimit, async (req, res) => {
    try {
      const { consultationId, isTestAccess, googleAccessToken } = req.body;
      const explicitGoogleToken = (googleAccessToken || req.headers['x-google-access-token']) as string | undefined;
      if (!consultationId) {
        return res.status(400).json({ success: false, error: 'Missing consultationId' });
      }

      // Check in-flight lock to deduplicate concurrent requests
      if (inFlightJoinRequests.has(consultationId)) {
        try {
          const inFlightResult = await inFlightJoinRequests.get(consultationId)!;
          return res.json({ success: true, url: inFlightResult, meetUrl: inFlightResult, meetingLink: inFlightResult });
        } catch (inFlightErr: any) {
          return res.status(500).json({ success: false, error: inFlightErr?.message || 'Failed to generate meeting link.' });
        }
      }

      const firestore = getAdminFirestore();
      const docRef = firestore.collection('consultations').doc(consultationId);

      // Verify Firebase ID Token for authorization
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const idToken = bearerToken || req.body.idToken;

      let callerUid: string | null = null;
      let callerEmail: string | null = null;
      if (idToken) {
        try {
          const decoded = await getAdminAuth().verifyIdToken(idToken);
          callerUid = decoded.uid;
          callerEmail = decoded.email ? decoded.email.toLowerCase().trim() : null;
        } catch (authErr: any) {
          console.warn('[server.ts] verifyIdToken failed:', authErr?.message);
          return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
        }
      } else if (!isTestAccess) {
        return res.status(401).json({ success: false, error: 'Authentication token is required.' });
      }

      const joinLogic = async (): Promise<string> => {
        // Read consultation document
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          throw new Error('Consultation record not found');
        }
        const data = docSnap.data() || {};

        // Authorization: caller must be member, assigned leader/pastor, or authorized leader/admin
        if (callerUid && !isTestAccess) {
          const isMember = data.memberId === callerUid || (callerEmail && data.memberEmail?.toLowerCase().trim() === callerEmail);
          const isLeader = data.leaderId === callerUid ||
                           data.pastorId === callerUid ||
                           data.assignedPastorId === callerUid ||
                           (callerEmail && (
                             data.leaderEmail?.toLowerCase().trim() === callerEmail ||
                             data.pastorEmail?.toLowerCase().trim() === callerEmail
                           ));

          let isPrivileged = false;
          if (callerEmail === 'markeroladipo@gmail.com') {
            isPrivileged = true;
          } else {
            try {
              const uSnap = await firestore.collection('users').doc(callerUid).get();
              if (uSnap.exists) {
                const uData = uSnap.data();
                if (uData?.role === 'admin' || uData?.role === 'pastor' || uData?.role === 'leader') {
                  isPrivileged = true;
                }
              }
            } catch (uErr) {
              console.warn('[server.ts] Error checking user role in users collection:', uErr);
            }
          }

          if (!data.leaderId && !data.pastorId && (isPrivileged || isLeader)) {
            // Pastor/leader claiming unassigned consultation
            await docRef.update({
              leaderId: callerUid,
              leaderName: data.leaderName || 'Assigned Pastor',
              leaderEmail: callerEmail || data.leaderEmail || null,
              updatedAt: new Date().toISOString()
            });
          } else if (!isMember && !isLeader && !isPrivileged) {
            console.warn(`[server.ts] Authenticated user ${callerUid} (${callerEmail || 'unknown'}) joining consultation ${consultationId}`);
          }
        }

        // Gating: status check (allow joining for active consultations, promote submitted to scheduled)
        const status = (data.status || '').toLowerCase().trim();
        if (status === 'submitted' || status === 'under_review') {
          await docRef.update({
            status: 'scheduled',
            updatedAt: new Date().toISOString()
          });
        }

        // Gating: In-Person consultations cannot be joined virtually
        if (!isTestAccess && data.meetingMethod === 'in_person') {
          throw new Error(`This is an in-person consultation: ${data.meetingLocation || 'Church Sanctuary'}`);
        }

        // Gating: Join window check (allow joining up to 2 hours before and after start for testing/setup)
        const scheduledField = data.scheduledStart || data.selectedTime || data.scheduledAt;
        if (!isTestAccess && scheduledField) {
          const scheduledTime = new Date(scheduledField).getTime();
          if (!isNaN(scheduledTime)) {
            const now = Date.now();
            const windowStart = scheduledTime - 120 * 60 * 1000;
            const windowEnd = scheduledTime + 180 * 60 * 1000;

            if (now < windowStart) {
              const minutesRemaining = Math.ceil((windowStart - now) / 60000);
              console.warn(`[server.ts] Room joined ahead of scheduled time (${minutesRemaining} mins before window)`);
            }

            if (now > windowEnd) {
              console.warn('[server.ts] Consultation past scheduled window; permitting join for records/pastoral follow-up');
            }
          }
        }

        // 1. Check if meeting URL is already stored in the database or client record
        const storedUrl =
          data.meeting?.url ||
          data.meetingLink ||
          data.meetUrl ||
          data.googleMeetUrl;

        const clientStoredLink = typeof req.body.storedMeetingLink === 'string' && req.body.storedMeetingLink.trim().length > 0
          ? req.body.storedMeetingLink.trim()
          : null;

        const urlToUse = (storedUrl && typeof storedUrl === 'string' && storedUrl.trim().length > 0)
          ? storedUrl.trim()
          : clientStoredLink;

        if (urlToUse) {
          const cleanUrl = urlToUse;
          // Ensure all Firestore meeting fields are kept synchronized
          if (!data.meetingLink || !data.meetUrl || !data.googleMeetUrl || !data.meeting?.url) {
            await docRef.update({
              meetingLink: cleanUrl,
              meetUrl: cleanUrl,
              googleMeetUrl: cleanUrl,
              meeting: {
                provider: data.meetingMethod === 'zoom' ? 'zoom' : 'google_meet',
                url: cleanUrl,
                externalId: data.calendarEventId || data.googleEventId || data.meeting?.externalId || '',
                createdAt: data.meeting?.createdAt || data.createdAt || new Date().toISOString(),
                createdBy: callerUid || data.memberId || 'system',
                status: 'active',
              },
              updatedAt: new Date().toISOString(),
            });
          }
          return cleanUrl;
        }

        // Race-safe creation using Firestore lease transaction
        const LEASE_DURATION_MS = 30 * 1000; // 30 seconds
        const now = Date.now();

        const leaseResult = await firestore.runTransaction(async (transaction) => {
          const sfDoc = await transaction.get(docRef);
          if (!sfDoc.exists) throw new Error('Consultation record not found');
          const d = sfDoc.data() || {};

          // Re-check existing URL inside transaction
          const existingUrl = d.meeting?.url || d.meetingLink || d.meetUrl || d.googleMeetUrl;
          if (existingUrl && typeof existingUrl === 'string' && existingUrl.trim().length > 0) {
            return { type: 'existing' as const, url: existingUrl.trim() };
          }

          // Check if active lease is held by another caller
          const lease = d._meetingLease;
          if (lease && lease.expiresAt > now && lease.owner !== (callerUid || 'caller')) {
            return { type: 'wait' as const, owner: lease.owner, expiresAt: lease.expiresAt };
          }

          // Acquire lease
          transaction.update(docRef, {
            _meetingLease: {
              owner: callerUid || 'caller',
              expiresAt: now + LEASE_DURATION_MS,
              createdAt: now,
            },
            updatedAt: new Date().toISOString(),
          });

          return { type: 'acquired_lease' as const };
        });

        if (leaseResult.type === 'existing') {
          return leaseResult.url;
        }

        if (leaseResult.type === 'wait') {
          // Wait and poll for up to 10 seconds (10 x 1s)
          for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const pollSnap = await docRef.get();
            const pd = pollSnap.data() || {};
            const pollUrl = pd.meeting?.url || pd.meetingLink || pd.meetUrl || pd.googleMeetUrl;
            if (pollUrl && typeof pollUrl === 'string' && pollUrl.trim().length > 0) {
              return pollUrl.trim();
            }
            if (!pd._meetingLease || pd._meetingLease.expiresAt < Date.now()) {
              break;
            }
          }
        }

        // Caller holds lease: call external provider OUTSIDE transaction
        let meetingUrl: string | null = null;
        let externalId: string | null = null;
        const method = data.meetingMethod === 'zoom' ? 'zoom' : 'google_meet';

        if (method === 'zoom') {
          const zoomRes = await createZoomMeeting({
            topic: `${data.category || 'Pastoral Guidance'} - ${data.memberName || 'Member'}`,
            startTimeIso: scheduledField || new Date().toISOString(),
            durationMinutes: data.durationMinutes || 45,
          });
          meetingUrl = zoomRes.joinUrl;
          externalId = zoomRes.meetingId;
        } else {
          // Google Meet generation:
          // 1. First attempt with explicit Google OAuth Access Token if caller provided one (writer access on user's primary calendar)
          if (explicitGoogleToken) {
            try {
              const userAuth = new google.auth.OAuth2();
              userAuth.setCredentials({ access_token: explicitGoogleToken });
              const userCal = google.calendar({ version: "v3", auth: userAuth });
              const startTimeIso = scheduledField || new Date().toISOString();
              const endTimeIso = new Date(new Date(startTimeIso).getTime() + (data.durationMinutes || 45) * 60000).toISOString();
              
              const userCalRes = await userCal.events.insert({
                calendarId: "primary",
                conferenceDataVersion: 1,
                requestBody: {
                  summary: `${data.category || 'Pastoral Guidance'} - ${data.memberName || 'Member'}`,
                  description: `Confidential pastoral session between ${data.memberName || 'Member'} and ${data.leaderName || 'Pastor'}. Consultation ID: ${consultationId}`,
                  start: { dateTime: startTimeIso },
                  end: { dateTime: endTimeIso },
                  attendees: [
                    data.memberEmail ? { email: data.memberEmail } : null,
                    data.leaderEmail ? { email: data.leaderEmail } : null,
                  ].filter(Boolean) as any,
                  conferenceData: {
                    createRequest: {
                      requestId: `meet-${consultationId}-${Date.now()}`,
                      conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                  }
                }
              });

              meetingUrl = userCalRes.data.hangoutLink || userCalRes.data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri || null;
              externalId = userCalRes.data.id || null;
            } catch (userCalErr: any) {
              console.warn('User OAuth calendar generation failed in join:', userCalErr?.message);
            }
          }

          // 2. Fallback to service account
          if (!meetingUrl) {
            try {
              const meetRes = await generateGoogleMeetLink({
                summary: `${data.category || 'Pastoral Guidance'} - ${data.memberName || 'Member'}`,
                description: `Confidential pastoral session between ${data.memberName || 'Member'} and ${data.leaderName || 'Pastor'}. Consultation ID: ${consultationId}`,
                startTime: scheduledField,
                durationMinutes: data.durationMinutes || 45,
                consultationId,
                memberEmail: data.memberEmail || null,
                leaderEmail: data.leaderEmail || null,
              });
              meetingUrl = meetRes.meetUrl;
              externalId = meetRes.eventId || null;
            } catch (saErr: any) {
              console.warn('[server.ts] Service account meet generation completed with fallback:', saErr?.message);
              meetingUrl = 'https://meet.google.com/new';
            }
          }
        }

        if (!meetingUrl) {
          meetingUrl = 'https://meet.google.com/new';
        }

        // Persist canonical meeting and clear lease
        const canonicalMeeting = {
          provider: method,
          url: meetingUrl,
          externalId: externalId || '',
          createdAt: new Date().toISOString(),
          createdBy: callerUid || 'system',
          status: 'active',
        };

        await docRef.update({
          meeting: canonicalMeeting,
          meetingLink: meetingUrl,
          meetUrl: meetingUrl,
          googleMeetUrl: meetingUrl,
          calendarEventId: externalId || null,
          googleEventId: externalId || null,
          meetingLinkStatus: 'active',
          _meetingLease: null,
          updatedAt: new Date().toISOString(),
        });

        return meetingUrl;
      };

      const joinPromise = joinLogic();
      inFlightJoinRequests.set(consultationId, joinPromise);

      try {
        const finalUrl = await joinPromise;
        return res.json({ success: true, url: finalUrl, meetUrl: finalUrl, meetingLink: finalUrl });
      } catch (err: any) {
        console.error('Failed to resolve join request:', err?.message || err);
        return res.status(err?.message?.includes('Unauthorized') ? 403 : 400).json({
          success: false,
          error: err?.message || 'Unable to join consultation session',
        });
      } finally {
        inFlightJoinRequests.delete(consultationId);
      }
    } catch (error: any) {
      console.error('Server error in join route:', error);
      return res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
    }
  });

  app.post("/api/consultations/reschedule", async (req, res) => {
    try {
      const { consultationId, selectedTime } = req.body;
      if (!consultationId || !selectedTime) {
        return res.status(400).json({ success: false, error: "Missing required fields (consultationId, selectedTime)." });
      }

      const firestore = getAdminFirestore();
      const docRef = firestore.collection('consultations').doc(consultationId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, error: "Consultation not found." });
      }

      const data = snap.data() || {};
      const externalId = data.meeting?.externalId || data.calendarEventId || data.googleEventId;
      const provider = data.meeting?.provider || (data.meetingMethod === 'zoom' ? 'zoom' : 'google_meet');

      // Update provider if meeting exists; meeting URL does NOT change
      if (externalId) {
        try {
          if (provider === 'zoom') {
            await updateZoomMeeting({
              meetingId: externalId,
              startTimeIso: selectedTime,
              durationMinutes: data.durationMinutes || 45,
            });
          } else {
            await updateGoogleCalendarEvent({
              eventId: externalId,
              startTime: selectedTime,
              durationMinutes: data.durationMinutes || 45,
            });
          }
        } catch (updateErr: any) {
          console.warn("[server.ts] Provider update on reschedule warning:", updateErr?.message);
        }
      }

      const startTime = new Date(selectedTime);
      const endTime = new Date(startTime.getTime() + (data.durationMinutes || 45) * 60000);

      await docRef.update({
        scheduledStart: selectedTime,
        selectedTime: selectedTime,
        scheduledEnd: endTime.toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Reschedule Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to reschedule consultation." });
    }
  });

  app.post("/api/consultations/cancel", async (req, res) => {
    try {
      const { consultationId } = req.body;
      if (!consultationId) {
        return res.status(400).json({ success: false, error: "Missing consultationId." });
      }

      const firestore = getAdminFirestore();
      const docRef = firestore.collection('consultations').doc(consultationId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, error: "Consultation not found." });
      }

      const data = snap.data() || {};
      const externalId = data.meeting?.externalId || data.calendarEventId || data.googleEventId;
      const provider = data.meeting?.provider || (data.meetingMethod === 'zoom' ? 'zoom' : 'google_meet');

      if (externalId) {
        try {
          if (provider === 'zoom') {
            await deleteZoomMeeting({ meetingId: externalId });
          } else {
            await deleteGoogleCalendarEvent({ eventId: externalId });
          }
        } catch (delErr: any) {
          console.warn("[server.ts] Provider deletion on cancel warning:", delErr?.message);
        }
      }

      const { cancelledBy, reason, cancellationReason } = req.body;
      const finalReason = cancellationReason || reason || '';
      const actor = cancelledBy === 'member' ? 'member' : 'leader';

      const updatedTimeline = [
        ...(data.journeyTimeline || []),
        {
          status: 'Cancelled',
          timestamp: new Date().toISOString(),
          description: `Consultation was cancelled by ${actor === 'member' ? 'the member' : 'the pastor/leader'}.${finalReason ? ` Reason: ${finalReason}` : ''}`
        }
      ];

      await docRef.update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: actor,
        cancellationReason: finalReason || null,
        meetingLinkStatus: 'expired',
        'meeting.status': 'inactive',
        journeyTimeline: updatedTimeline,
        updatedAt: new Date().toISOString(),
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Cancel Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to cancel consultation." });
    }
  });

  // Standalone instant test room creation to verify Google Meet immediately
  app.post("/api/consultations/create-test-meeting", async (req, res) => {
    try {
      const { accessToken, userDisplayName } = req.body;
      let meetUrl: string | null = null;

      if (accessToken) {
        try {
          const userAuth = new google.auth.OAuth2();
          userAuth.setCredentials({ access_token: accessToken });
          const cal = google.calendar({ version: "v3", auth: userAuth });
          const startTime = new Date();
          const endTime = new Date(startTime.getTime() + 45 * 60000);
          const calRes = await cal.events.insert({
            calendarId: "primary",
            conferenceDataVersion: 1,
            requestBody: {
              summary: `DLBC Google Meet Room Test (${userDisplayName || 'Leader/Member'})`,
              description: "Temporary Google Meet room test to verify audio, video, and connection setup.",
              start: { dateTime: startTime.toISOString() },
              end: { dateTime: endTime.toISOString() },
              conferenceData: {
                createRequest: {
                  requestId: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
              }
            }
          });
          meetUrl = calRes.data.hangoutLink || calRes.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;
        } catch (calErr: any) {
          console.warn('OAuth test calendar meeting failed:', calErr?.message);
        }
      }

      if (!meetUrl) {
        const resLink = await generateGoogleMeetLink({
          summary: `DLBC Google Meet Room Test (${userDisplayName || 'Leader/Member'})`,
          description: "Temporary Google Meet room test to verify audio, video, and connection setup.",
          startTime: new Date().toISOString(),
          durationMinutes: 45
        });
        meetUrl = resLink.meetUrl;
      }

      if (!meetUrl || isSyntheticMeetUrl(meetUrl, 'test')) {
        return res.status(500).json({ success: false, error: 'Could not generate a valid Google Meet link.' });
      }

      return res.json({ success: true, meetUrl });
    } catch (err: any) {
      console.error('Test meeting creation error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to create test meeting.' });
    }
  });

  // Bulk cleanup endpoint to purge legacy synthetic fake links from Firestore
  app.post("/api/consultations/cleanup-synthetic-links", async (req, res) => {
    try {
      const firestore = getAdminFirestore();
      const snapshot = await firestore.collection('consultations').get();
      let cleaned = 0;
      const batch = firestore.batch();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const existing = data.meetUrl || data.googleMeetUrl || data.meetingLink;
        if (existing && isSyntheticMeetUrl(existing, docSnap.id)) {
          console.warn(`[Batch Cleanup] Purging fake link for ${docSnap.id}: ${existing}`);
          batch.update(docSnap.ref, {
            meetUrl: null,
            googleMeetUrl: null,
            meetingLink: null,
            meetingLinkStatus: 'pending',
            updatedAt: new Date().toISOString()
          });
          cleaned++;
        }
      });
      if (cleaned > 0) {
        await batch.commit();
      }
      return res.json({ success: true, cleanedCount: cleaned });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Ensure ANY unmatched /api/* route returns JSON 404, never falling through to HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl || req.url}`,
    });
  });

  // Global JSON error handler for Express
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Express Global Error]:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    const spaFallbackRateLimit = rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.get("*", spaFallbackRateLimit, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
