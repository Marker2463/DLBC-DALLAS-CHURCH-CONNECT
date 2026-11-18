import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, ArrowRight } from 'lucide-react';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { useToast } from '../../components/ui/ToastProvider';
import { Popover } from '../../components/ui/Popover';
import { useAuth } from '../../lib/AuthContext';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated, role: authRole, loading: authLoading, redirectError, clearRedirectError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<'member' | 'leader' | 'pastor'>('member');
  const [loading, setLoading] = useState(false);
  
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const prefill = searchParams.get('email');
    if (prefill) {
      setEmail(prefill);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && authRole) {
      if (authRole === 'admin') {
        navigate('/admin/roles', { replace: true });
      } else if (authRole === 'pastor') {
        navigate('/pastor/dashboard', { replace: true });
      } else if (authRole === 'leader') {
        navigate('/leader/dashboard', { replace: true });
      } else {
        navigate('/member/dashboard', { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, authRole, navigate]);

  useEffect(() => {
    if (redirectError) {
      showToast({
        variant: 'info',
        title: 'Google Sign-Up',
        message: redirectError,
      });
      clearRedirectError();
    }
  }, [redirectError, clearRedirectError, showToast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: any) {
      console.error('Registration Error:', err.code, err.message);
      switch (err.code) {
        case 'auth/email-already-in-use':
          showToast({
            variant: 'warning',
            title: 'Account Already Exists',
            message: 'An account is already registered with this email.',
            action: {
              label: 'Sign In',
              onClick: () => navigate(`/auth/login?email=${encodeURIComponent(cleanEmail)}`),
            },
          });
          break;
        case 'auth/weak-password':
          showToast({
            variant: 'error',
            title: 'Weak Password',
            message: 'Password should be at least 6 characters long.',
          });
          break;
        case 'auth/invalid-email':
          showToast({
            variant: 'error',
            title: 'Invalid Email',
            message: 'Please provide a valid email address.',
          });
          break;
        default:
          showToast({
            variant: 'error',
            title: 'Registration Failed',
            message: err.message || 'Failed to create account. Please try again.',
          });
      }
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      await updateProfile(userCredential.user, {
        displayName: name.trim()
      });

      const needsApproval = requestedRole === 'leader' || requestedRole === 'pastor';
      const actualRole: 'member' | 'leader' | 'pastor' = 'member';

      const userDocPayload: any = {
        uid: userCredential.user.uid,
        displayName: name.trim(),
        email: cleanEmail,
        role: actualRole,
        requestedRole: requestedRole,
        pendingRoleApproval: needsApproval,
        createdAt: new Date().toISOString()
      };

      if (needsApproval) {
        userDocPayload.roleApprovalRequestedAt = new Date().toISOString();
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), userDocPayload);
    } catch (profileErr: any) {
      console.error('Profile creation error after successful auth.', profileErr);
      
      // Cleanup the orphaned auth user
      try {
        await userCredential.user.delete();
      } catch (deleteErr) {
        console.error('Failed to delete orphaned user', deleteErr);
      }
      
      showToast({
        variant: 'error',
        title: 'Profile Setup Failed',
        message: 'Failed to set up your profile. Please try again.',
      });
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    setLoading(false);
    isSubmittingRef.current = false;
    
    navigate('/member/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 sm:px-6 w-full max-w-7xl mx-auto py-10 sm:py-16">
      <div className="w-full max-w-md bg-surface rounded-2xl p-5 sm:p-8 md:p-10 halo-border flex flex-col items-center text-center shadow-sm">
        
        <h1 className="font-serif text-3xl text-primary mb-6">Create Account</h1>

        {/* Google Sign Up Button */}
        <div className="w-full mb-6">
          <GoogleSignInButton
            text="Sign up with Google"
            desiredRole={requestedRole}
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
            onCancel={(msg) => showToast({ variant: 'info', title: 'Sign-Up Cancelled', message: msg })}
            onError={(msg) => showToast({ variant: 'error', title: 'Google Sign-Up Failed', message: msg })}
          />
        </div>

        <div className="w-full flex items-center gap-3 mb-6">
          <div className="flex-1 h-[1px] bg-primary/10"></div>
          <span className="font-sans text-xs text-primary-muted uppercase tracking-wider text-center">Or register with email</span>
          <div className="flex-1 h-[1px] bg-primary/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
          
          <div className="space-y-1.5">
            <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary" htmlFor="name">
              Full Name
            </label>
            <input 
              id="name" 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-[#e2dcce] focus:border-[#1c202e] focus:ring-1 focus:ring-[#1c202e] rounded-xl text-sm px-3.5 py-2.5 outline-none transition-colors" 
              placeholder="e.g. John Doe" 
              required 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary" htmlFor="email">
              Email Address
            </label>
            <input 
              id="email" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-[#e2dcce] focus:border-[#1c202e] focus:ring-1 focus:ring-[#1c202e] rounded-xl text-sm px-3.5 py-2.5 outline-none transition-colors" 
              placeholder="you@example.com" 
              required 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary" htmlFor="password">
              Password (6+ characters)
            </label>
            <input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-[#e2dcce] focus:border-[#1c202e] focus:ring-1 focus:ring-[#1c202e] rounded-xl text-sm px-3.5 py-2.5 outline-none transition-colors" 
              placeholder="••••••••" 
              minLength={6}
              required 
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary">
              Account Purpose / Role
            </label>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRequestedRole('member')}
                className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  requestedRole === 'member'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-primary-muted border-[#e2dcce] hover:border-primary/40'
                }`}
              >
                Church Member
              </button>
              <button
                type="button"
                onClick={() => setRequestedRole('leader')}
                className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  requestedRole === 'leader'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-primary-muted border-[#e2dcce] hover:border-primary/40'
                }`}
              >
                Ministry Leader
              </button>
              <button
                type="button"
                onClick={() => setRequestedRole('pastor')}
                className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  requestedRole === 'pastor'
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-primary-muted border-[#e2dcce] hover:border-primary/40'
                }`}
              >
                Pastor
              </button>
            </div>
            {requestedRole !== 'member' && (
              <div className="flex items-center justify-between gap-2 pt-1.5">
                <span className="text-xs text-primary-muted">Requires administrator approval</span>
                <Popover title="Leadership Verification" triggerLabel="Details" align="right">
                  <p>
                    Leader &amp; Pastor accounts activate immediately with standard member access and receive pastoral dashboard privileges once verified by an administrator.
                  </p>
                </Popover>
              </div>
            )}
          </div>
          
          <div className="pt-3">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#1e232a] text-white hover:bg-[#2c323b] py-3.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating Account...
                </>
              ) : (
                <>
                  Begin Sanctuary Journey <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-8 text-center w-full pt-4 border-t border-primary/10">
          <p className="font-sans text-xs text-primary-muted">
            Already walking with us? 
            <Link to="/auth/login" className="text-primary font-bold hover:text-secondary transition-colors ml-1.5 uppercase tracking-wider">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

