import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  projectId: "dlbc-dallas-church-connect",
  appId: "1:571793135981:web:59ea0ffd2bc3915f5e6264",
  apiKey: "AIzaSyD_qDevRG_VtrBh1anEAWRVWgPLtlG9qhg",
  authDomain: "dlbc-dallas-church-connect.firebaseapp.com",
  storageBucket: "dlbc-dallas-church-connect.firebasestorage.app",
  messagingSenderId: "571793135981",
  measurementId: "",
};

export const app = initializeApp(firebaseConfig);
const databaseId = "ai-studio-dlbcchurchconnec-d51b846f-e39f-40ba-8929-2e22d9a82610";
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

// Helper types
export type UserRole = 'member' | 'leader' | 'pastor' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  leaderType?: 'youth' | 'children' | 'pastoral' | null;
  membershipId?: string;
  memberSince?: string;
  photoURL?: string;
}

export interface Appointment {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  pastorId: string;
  pastorName: string;
  scheduledAt: string; // ISO 8601 string
  durationMinutes: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  meetUrl?: string; // Central shared Google Meet URL
  calendarEventId?: string; // Shared Google Calendar Event ID
  createdAt: string;
  updatedAt: string;
}

export * from '../types/consultation';

export interface LeaderAvailability {
  leaderId: string;
  weeklySchedule: {
    [dayOfWeek: string]: { 
      enabled: boolean; 
      slots: string[]; 
    };
  };
  blackoutDates: string[];
}
