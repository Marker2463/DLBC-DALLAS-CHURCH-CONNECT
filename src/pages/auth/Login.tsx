import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FormEvent, useState, useRef, useEffect } from 'react';
import { auth, db, UserProfile } from '../../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowRight, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { useToast } from '../../components/ui/ToastProvider';

interface DemoAccount {
  label: string;
  sublabel: string;
  email: string;
  name: string;
  role: 'member' | 'leader' | 'pastor' | 'admin';
  leaderType?: 'pastoral' | 'youth' | 'children';
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'Member',
    sublabel: 'Congregant',
    email: 'member@dlbc.org',
    name: 'Bro. Emmanuel Johnson',
    role: 'member'
  },
  {
    label: 'Youth Leader',
    sublabel: 'Youth Ministry',
    email: 'leader@dlbc.org',
    name: 'Sister Grace Adeyemi',
    role: 'leader',
    leaderType: 'youth'
  },
  {
    label: 'Pastor',
    sublabel: 'Pastoral Care',
    email: 'pastor@dlbc.org',
    name: 'Pastor Samuel Olatunji',
    role: 'pastor',
    leaderType: 'pastoral'
  }
];

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickAction, setQuickAction] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const prefilledEmail = searchParams.get('email');
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [searchParams]);

  // Helper to ensure initial weekly schedule exists for leaders
  const ensureLeaderAvailability = async (leaderId: string) => {
    try {
      const availRef = doc(db, 'availability', leaderId);
      const availSnap = await getDoc(availRef);
      if (!availSnap.exists()) {
        const defaultSlots = ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];
        await setDoc(availRef, {
          leaderId,
          weeklySchedule: {
            Monday: { enabled: true, slots: defaultSlots },
            Tuesday: { enabled: true, slots: defaultSlots },
            Wednesday: { enabled: true, slots: defaultSlots },
            Thursday: { enabled: true, slots: defaultSlots },
            Friday: { enabled: true, slots: defaultSlots },
            Saturday: { enabled: true, slots: ["10:00 AM", "02:00 PM"] },
            Sunday: { enabled: true, slots: ["02:00 PM", "03:30 PM", "05:00 PM"] }
          },
          blackoutDates: [],
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("Could not seed availability:", e);
    }
  };

  const isDemoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  const authenticateUser = async (cleanEmail: string, pass: string) => {
    // Only attempt standard sign-in. A failed sign-in must never create an account.
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const uid = userCredential.user.uid;
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      throw new Error('User profile record not found. Please contact administration or register.');
    }

    const data = userDoc.data() as UserProfile;
    const role = data.role || 'member';

    if (role === 'leader' || role === 'pastor') {
      await ensureLeaderAvailability(uid);
    }

    return role;
  };

  const handleQuickDemoLogin = async (demo: DemoAccount) => {
    if (loading) return;
    setLoading(true);
    setQuickAction(demo.label);
    setEmail(demo.email);
    setPassword('password123');

    try {
      let role = 'member';
      try {
        role = await authenticateUser(demo.email.toLowerCase(), 'password123');
      } catch (authErr: any) {
        if (isDemoLoginEnabled && (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential' || authErr?.code === 'auth/invalid-login-credentials')) {
          // In development with demo login enabled, seed demo accounts once with password123
          const userCredential = await createUserWithEmailAndPassword(auth, demo.email.toLowerCase(), 'password123');
          await updateProfile(userCredential.user, { displayName: demo.name });
          const userDocRef = doc(db, 'users', userCredential.user.uid);
          await setDoc(userDocRef, {
            uid: userCredential.user.uid,
            displayName: demo.name,
            email: demo.email.toLowerCase(),
            role: demo.role,
            leaderType: demo.leaderType || null,
            createdAt: new Date().toISOString()
          });
          role = demo.role;
          if (role === 'leader' || role === 'pastor') {
            await ensureLeaderAvailability(userCredential.user.uid);
          }
        } else {
          throw authErr;
        }
      }
      
      if (role === 'admin') {
        navigate('/admin/roles');
      } else if (role === 'pastor') {
        navigate('/pastor/dashboard');
      } else if (role === 'leader') {
        navigate('/leader/dashboard');
      } else {
        navigate('/member/dashboard');
      }
    } catch (err: any) {
      console.error('Demo Login Error:', err);
      showToast({
        variant: 'error',
        title: 'Demo Sign-In Unavailable',
        message: 'Unable to log in to demo account. Please try again.',
      });
    } finally {
      setLoading(false);
      setQuickAction(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    
    const cleanEmail = email.trim().toLowerCase();

    try {
      const role = await authenticateUser(cleanEmail, password);
      
      if (role === 'admin') {
        navigate('/admin/roles');
      } else if (role === 'pastor') {
        navigate('/pastor/dashboard');
      } else if (role === 'leader') {
        navigate('/leader/dashboard');
      } else {
        navigate('/member/dashboard');
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error('Login Error:', err.code, err.message);
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          showToast({
            variant: 'error',
            title: 'Invalid Credentials',
            message: 'Email or password did not match. New to the sanctuary?',
            action: {
              label: 'Create Account',
              onClick: () => navigate(`/auth/register?email=${encodeURIComponent(cleanEmail)}`),
            },
          });
          break;
        case 'auth/too-many-requests':
          showToast({
            variant: 'warning',
            title: 'Too Many Attempts',
            message: 'Please wait a moment before trying to sign in again.',
          });
          break;
        default:
          showToast({
            variant: 'error',
            title: 'Sign-In Failed',
            message: err.message || 'Please check your credentials and try again.',
          });
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 sm:px-6 w-full max-w-7xl mx-auto py-10 sm:py-16">
      <div className="w-full max-w-md bg-surface rounded-2xl p-5 sm:p-8 md:p-10 halo-border flex flex-col items-center text-center shadow-sm">
        
        <h1 className="font-serif text-3xl text-primary mb-6">Sign In</h1>

        {/* Google Sign In Button */}
        <div className="w-full mb-6">
          <GoogleSignInButton
            onSuccess={(userRole) => {
              if (userRole === 'admin') {
                navigate('/admin/roles');
              } else if (userRole === 'pastor') {
                navigate('/pastor/dashboard');
              } else if (userRole === 'leader') {
                navigate('/leader/dashboard');
              } else {
                navigate('/member/dashboard');
              }
            }}
            onError={(msg) => showToast({ variant: 'error', title: 'Google Sign-In Failed', message: msg })}
          />
        </div>

        {/* 1-Click Quick Demo Sign-Ins - only rendered if VITE_ENABLE_DEMO_LOGIN === 'true' */}
        {isDemoLoginEnabled && (
          <>
            <div className="w-full flex items-center gap-3 mb-6">
              <div className="flex-1 h-[1px] bg-primary/10"></div>
              <span className="font-sans text-xs text-primary-muted uppercase tracking-wider text-center">Or quick demo access</span>
              <div className="flex-1 h-[1px] bg-primary/10"></div>
            </div>

            <div className="w-full mb-6 p-3.5 sm:p-4 rounded-xl bg-[#faf8f5] border border-primary/10 text-left">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5">
                <span className="font-sans text-xs font-bold text-primary uppercase tracking-widest">
                  Quick Demo Access
                </span>
                <span className="font-sans text-xs text-primary-muted">One-click sign in</span>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.label}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickDemoLogin(demo)}
                    className="px-2.5 py-2 rounded-lg bg-white border border-primary/15 hover:border-[#1c202e] hover:bg-primary/[0.02] transition-all text-left group shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    <span className="block font-sans text-xs font-semibold text-primary group-hover:text-primary transition-colors truncate">
                      {quickAction === demo.label ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                      {demo.label}
                    </span>
                    <span className="block font-sans text-xs text-primary-muted truncate">
                      {demo.sublabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="w-full flex items-center gap-3 mb-6">
          <div className="flex-1 h-[1px] bg-primary/10"></div>
          <span className="font-sans text-xs text-primary-muted uppercase tracking-wider">Or sign in with email</span>
          <div className="flex-1 h-[1px] bg-primary/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
          
          <div className="space-y-1.5">
            <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <input 
                id="email" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#e2dcce] focus:border-[#1c202e] focus:ring-1 focus:ring-[#1c202e] rounded-xl text-sm px-3.5 py-2.5 outline-none transition-colors" 
                placeholder="you@dlbc.org" 
                required
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-center w-full">
              <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary" htmlFor="password">
                Password
              </label>
            </div>
            <input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-[#e2dcce] focus:border-[#1c202e] focus:ring-1 focus:ring-[#1c202e] rounded-xl text-sm px-3.5 py-2.5 outline-none transition-colors" 
              placeholder="••••••••" 
              required
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#1e232a] text-white hover:bg-[#2c323b] py-3.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md cursor-pointer"
            >
              {loading && !quickAction ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Signing In...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center w-full pt-4 border-t border-primary/10">
          <p className="font-sans text-xs text-primary-muted">
            Seeking connection? 
            <Link to="/auth/register" className="text-primary font-bold hover:text-secondary transition-colors ml-1.5 uppercase tracking-wider">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

