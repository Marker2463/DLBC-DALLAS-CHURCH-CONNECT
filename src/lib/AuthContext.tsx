import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { auth, db, UserProfile, UserRole } from './firebase';
import {
  getRedirectResult,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  ensureGoogleUserProfile,
  formatFirebaseAuthError,
  signInWithGoogle as clientSignInWithGoogle,
  GoogleSignInResult,
} from './googleMeetClient';

type AuthContextType = {
  isAuthenticated: boolean;
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole | null;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  signInWithGoogle: (desiredRole?: UserRole) => Promise<GoogleSignInResult>;
  redirectError: string | null;
  clearRedirectError: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [rawFirebaseUser, setRawFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearRedirectError = useCallback(() => {
    setRedirectError(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let authStateResolved = false;
    let redirectResolved = false;

    const finishLoadingIfReady = () => {
      if (mounted && authStateResolved && redirectResolved) {
        setLoading(false);
      }
    };

    // Handle redirect-based Google Sign-In results on initial mount
    const redirectPromise = getRedirectResult(auth)
      .then(async (result) => {
        if (!mounted || !result?.user) return;
        await ensureGoogleUserProfile(result.user);
      })
      .catch((err: any) => {
        if (!mounted) return;
        if (
          err?.code === 'auth/popup-closed-by-user' ||
          err?.code === 'auth/cancelled-popup-request'
        ) {
          setRedirectError(formatFirebaseAuthError(err));
          return;
        }
        console.error('Google redirect result error:', err);
        setRedirectError(formatFirebaseAuthError(err));
      })
      .finally(() => {
        redirectResolved = true;
        finishLoadingIfReady();
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      setRawFirebaseUser(firebaseUser);
      if (firebaseUser) {
        // Ensure redirect profile creation (with any pending role) finishes before reading user doc
        await redirectPromise;
        if (!mounted) return;

        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          const currentRole = profile.role || 'member';
          setUser({ ...profile, role: currentRole });
          setRole(currentRole);
          setIsAuthenticated(true);
        } else {
          let fallbackProfile: UserProfile;
          try {
            fallbackProfile = await ensureGoogleUserProfile(firebaseUser);
          } catch (e) {
            console.error('Failed to auto-heal missing user profile', e);
            fallbackProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'User',
              email: firebaseUser.email?.toLowerCase().trim() || '',
              role: 'member',
            };
          }

          setUser(fallbackProfile);
          setRole(fallbackProfile.role || 'member');
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
      }

      authStateResolved = true;
      finishLoadingIfReady();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    const current = rawFirebaseUser || auth.currentUser;
    if (!current) return null;
    return current.getIdToken(forceRefresh);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        firebaseUser: rawFirebaseUser,
        role,
        logout,
        getIdToken,
        signInWithGoogle: clientSignInWithGoogle,
        redirectError,
        clearRedirectError,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
