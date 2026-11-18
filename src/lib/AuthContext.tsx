import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db, UserProfile, UserRole } from './firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { User as FirebaseUser } from 'firebase/auth';

type AuthContextType = {
  isAuthenticated: boolean;
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole | null;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [rawFirebaseUser, setRawFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setRawFirebaseUser(firebaseUser);
      if (firebaseUser) {
        // Fetch user profile from Firestore
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          const currentRole = profile.role || 'member';
          setUser({ ...profile, role: currentRole });
          setRole(currentRole);
          setIsAuthenticated(true);
        } else {
          // Self-heal: Create missing profile document if it somehow failed during registration (member role only)
          const { setDoc } = await import('firebase/firestore');
          const newProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'User',
            email: firebaseUser.email?.toLowerCase().trim() || '',
            role: 'member' as UserRole,
            createdAt: new Date().toISOString()
          };
          
          try {
            await setDoc(docRef, newProfile);
          } catch (e) {
            console.error('Failed to auto-heal missing user profile', e);
          }

          setUser(newProfile as UserProfile);
          setRole('member');
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setRole(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
