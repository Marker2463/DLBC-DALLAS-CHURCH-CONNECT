import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, Consultation } from './firebase';
import { isSyntheticMeetUrl } from './meetUrlUtils';

export { isSyntheticMeetUrl };

/**
 * Resolves or retrieves the canonical consultation Google Meet meeting URL.
 * Uses the backend's pastor-owned OAuth calendar provider.
 */
export async function getOrInitializeMeetUrl(
  appointmentId: string
): Promise<string> {
  if (!appointmentId?.trim()) {
    throw new Error('Appointment ID is required to resolve meeting link.');
  }

  // 1. Read-first check
  try {
    const consultationRef = doc(db, 'consultations', appointmentId);
    const snap = await getDoc(consultationRef);
    if (snap.exists()) {
      const data = snap.data();
      const existing = data.meetUrl || data.googleMeetUrl || data.meetingLink;
      if (existing && typeof existing === 'string' && existing.trim().length > 0 && !isSyntheticMeetUrl(existing, appointmentId)) {
        return existing.trim();
      }
    }
  } catch {
    // Non-fatal, proceed to canonical endpoint
  }

  // 2. Backend lookup via /api/consultations/join
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sign in before joining a consultation session.');
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/consultations/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ consultationId: appointmentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.meetUrl) {
    throw new Error(data?.error || data?.message || 'Unable to retrieve meeting link.');
  }
  return data.meetUrl;
}

/**
 * Subscribe to real-time updates for a single consultation/appointment.
 */
export function subscribeToAppointment(
  appointmentId: string,
  onUpdate: (consultation: Consultation | null) => void,
  onError?: (error: Error) => void
): () => void {
  const docRef = doc(db, 'consultations', appointmentId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...snap.data() } as Consultation);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error(`Error in appointment subscription (${appointmentId}):`, err);
      if (onError) onError(err);
    }
  );
}
