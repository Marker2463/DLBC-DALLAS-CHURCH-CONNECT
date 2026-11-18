import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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

export const PENDING_GOOGLE_ROLE_KEY = 'dlbc_pending_google_role';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function formatFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled because the pop-up window was closed before finishing. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was interrupted by another request. Please try signing in again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in pop-up. Redirecting you to Google Sign-In...';
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorized for Google Sign-In in Firebase Authentication settings.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Please sign in with email and password.';
    case 'auth/network-request-failed':
      return 'Network connection error while contacting Google. Please check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact pastoral administration for assistance.';
    default:
      return 'Unable to complete Google Sign-In right now. Please try again or use email sign-in.';
  }
}

export async function ensureGoogleUserProfile(
  firebaseUser: User,
  desiredRole: UserRole = 'member'
): Promise<UserProfile> {
  const cleanEmail = firebaseUser.email?.toLowerCase().trim() || '';

  if (!cleanEmail) {
    throw new Error('Your Google account has no email address.');
  }

  let effectiveDesiredRole = desiredRole;
  if (typeof window !== 'undefined') {
    const storedRole = sessionStorage.getItem(PENDING_GOOGLE_ROLE_KEY) as UserRole | null;
    if (storedRole) {
      effectiveDesiredRole = storedRole;
      sessionStorage.removeItem(PENDING_GOOGLE_ROLE_KEY);
    }
  }

  const uid = firebaseUser.uid;
  const userDocRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    return userDoc.data() as UserProfile;
  }

  const isSpecialRoleRequested =
    effectiveDesiredRole === 'leader' || effectiveDesiredRole === 'pastor';

  const profile: UserProfile = {
    uid,
    displayName:
      firebaseUser.displayName || cleanEmail.split('@')[0] || 'Member',
    email: cleanEmail,
    role: 'member',
    ...(isSpecialRoleRequested
      ? { requestedRole: effectiveDesiredRole, pendingRoleApproval: true }
      : {}),
    photoURL: firebaseUser.photoURL || undefined,
    memberSince: new Date().toISOString(),
  };

  await setDoc(userDocRef, profile);
  return profile;
}

export type GoogleSignInResult =
  | { redirecting: true; user?: undefined; profile?: undefined; accessToken?: undefined }
  | { redirecting?: false; user: User; profile: UserProfile; accessToken: string };

export async function signInWithGoogle(
  desiredRole: UserRole = 'member'
): Promise<GoogleSignInResult> {
  // Persist desired role synchronously before popup/redirect in case redirect reloads page
  if (typeof window !== 'undefined') {
    if (desiredRole === 'leader' || desiredRole === 'pastor') {
      sessionStorage.setItem(PENDING_GOOGLE_ROLE_KEY, desiredRole);
    } else {
      sessionStorage.removeItem(PENDING_GOOGLE_ROLE_KEY);
    }
  }

  // On mobile browsers, go straight to redirect without async calls beforehand
  if (isMobileBrowser()) {
    await signInWithRedirect(auth, googleProvider);
    return { redirecting: true };
  }

  let result;
  try {
    // Invoke signInWithPopup immediately as the first async call in the click handler
    result = await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return { redirecting: true };
    }
    throw err;
  }

  const profile = await ensureGoogleUserProfile(result.user, desiredRole);

  return {
    redirecting: false,
    user: result.user,
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
