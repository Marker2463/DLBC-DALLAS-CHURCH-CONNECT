import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

import {
  auth,
  db,
  UserProfile,
  UserRole,
} from './firebase';

export interface ConsultationMeetingResponse {
  meetUrl: string;
  eventId: string;
  meetingHostEmail: string;
  reused: boolean;
}

async function getFirebaseHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Sign in before continuing.');
  }

  const idToken = await user.getIdToken();

  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Called by an approved pastor or leader from their account settings.
 *
 * The backend verifies their Firebase role and sends them through
 * Google's separate Calendar authorization process.
 */
export async function connectPastorGoogleCalendar(): Promise<void> {
  const headers = await getFirebaseHeaders();

  const response = await fetch('/api/google/oauth/start', {
    method: 'POST',
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.authorizationUrl) {
    throw new Error(
      data.message || 'Unable to connect your Google Calendar.'
    );
  }

  window.location.assign(data.authorizationUrl);
}

/**
 * Checks if the current leader/pastor has connected their Google Calendar.
 */
export async function getPastorGoogleCalendarStatus(): Promise<{
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
}> {
  try {
    const headers = await getFirebaseHeaders();
    const response = await fetch('/api/google/oauth/status', {
      method: 'GET',
      headers,
    });
    if (!response.ok) return { connected: false };
    const data = await response.json();
    return {
      connected: Boolean(data.connected),
      email: data.email || null,
      connectedAt: data.connectedAt || null,
    };
  } catch {
    return { connected: false };
  }
}

/**
 * Called by either the assigned pastor or the assigned member.
 *
 * It creates the meeting only if it does not already exist.
 * Otherwise, the backend returns the same saved Firestore URL.
 */
export async function createConsultationMeeting(
  consultationId: string
): Promise<ConsultationMeetingResponse> {
  if (!consultationId?.trim()) {
    throw new Error('Consultation ID is required.');
  }

  const headers = await getFirebaseHeaders();

  const response = await fetch(
    `/api/consultations/${encodeURIComponent(consultationId)}/meeting`,
    {
      method: 'POST',
      headers,
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err: any = new Error(
      data.message || 'Unable to retrieve the consultation meeting.'
    );
    err.code = data.code;
    throw err;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(data.meetUrl);
  } catch {
    throw new Error('The server returned an invalid meeting URL.');
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'meet.google.com' ||
    parsedUrl.pathname === '/new' ||
    typeof data.eventId !== 'string' ||
    !data.eventId
  ) {
    throw new Error('A valid consultation meeting was not returned.');
  }

  return {
    meetUrl: data.meetUrl,
    eventId: data.eventId,
    meetingHostEmail: data.meetingHostEmail || '',
    reused: Boolean(data.reused),
  };
}

/**
 * Both dashboards can call this same function.
 * It navigates to the URL returned by the backend.
 */
export async function joinConsultationMeeting(
  consultationId: string
): Promise<void> {
  const meeting = await createConsultationMeeting(consultationId);

  window.location.assign(meeting.meetUrl);
}

/* -------------------------------------------------------
   Firebase Authentication (Sign-in / Sign-out)
   Kept separate from Google Calendar authorization
------------------------------------------------------- */

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export async function signInWithGoogle(
  desiredRole: UserRole = 'member'
): Promise<{
  user: User;
  profile: UserProfile;
  accessToken: string;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const firebaseUser = result.user;

  const cleanEmail =
    firebaseUser.email?.toLowerCase().trim() || '';

  if (!cleanEmail) {
    throw new Error('Your Google account has no email address.');
  }

  const uid = firebaseUser.uid;
  const userDocRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userDocRef);

  let profile: UserProfile;

  if (userDoc.exists()) {
    profile = userDoc.data() as UserProfile;
  } else {
    const isSpecialRoleRequested = desiredRole === 'leader' || desiredRole === 'pastor';

    profile = {
      uid,
      displayName:
        firebaseUser.displayName ||
        cleanEmail.split('@')[0] ||
        'Member',
      email: cleanEmail,
      role: 'member',
      ...(isSpecialRoleRequested ? { requestedRole: desiredRole, pendingRoleApproval: true } : {}),
      photoURL: firebaseUser.photoURL || undefined,
      memberSince: new Date().toISOString(),
    };

    await setDoc(userDocRef, profile);
  }

  return {
    user: firebaseUser,
    profile,
    accessToken: '',
  };
}

export function getGoogleAccessToken(): string | null {
  return null;
}

export async function requestGoogleAccessToken(): Promise<string | null> {
  return null;
}

export async function signOutGoogle(): Promise<void> {
  await firebaseSignOut(auth);
}
