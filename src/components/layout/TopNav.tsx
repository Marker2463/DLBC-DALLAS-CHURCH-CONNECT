import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

interface NavItem {
  name: string;
  path: string;
}

const publicNav: NavItem[] = [
  { name: 'Ministry', path: '/ministry-guidelines' },
  { name: 'Leadership', path: '/leadership' },
  { name: 'Process', path: '/process' },
  { name: 'Resources', path: '/resources' },
];

const memberNav: NavItem[] = [
  { name: 'Dashboard', path: '/member/dashboard' },
  { name: 'Request Consultation', path: '/member/request' },
  { name: 'Consultations', path: '/member/sanctuary' },
];

const leaderNav: NavItem[] = [
  { name: 'Leader Dashboard', path: '/leader/dashboard' },
  { name: 'Availability', path: '/pastor/availability' },
  { name: 'Consultations', path: '/pastor/sanctuary' },
  { name: 'Records', path: '/pastor/archives' },
];

const pastorNav: NavItem[] = [
  { name: 'Pastor Dashboard', path: '/pastor/dashboard' },
  { name: 'Availability', path: '/pastor/availability' },
  { name: 'Consultations', path: '/pastor/sanctuary' },
  { name: 'Records', path: '/pastor/archives' },
];

const adminNav: NavItem[] = [
  { name: 'Leadership Assignments', path: '/admin/roles' },
  { name: 'Ministry', path: '/ministry-guidelines' },
  { name: 'Leadership', path: '/leadership' },
  { name: 'Process', path: '/process' },
  { name: 'Resources', path: '/resources' },
];

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role, user, logout, loading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const isAdmin = user?.email === 'markeroladipo@gmail.com' || role === 'admin';
  const isPastor = role === 'pastor';
  const isLeader = role === 'leader';

  const activeMenu = !isAuthenticated 
    ? publicNav 
    : (isAdmin ? adminNav : (isPastor ? pastorNav : (isLeader ? leaderNav : memberNav)));

  const isMemberDetail = location.pathname.startsWith('/member/request/');
  const isPastorDetail = location.pathname.startsWith('/pastor/request/');

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 lg:h-20 items-center justify-between gap-2 sm:gap-4 lg:gap-8 border-b border-[#ebdcd0] bg-background px-3 sm:px-6 lg:px-8">
        {/* Brand Identification Logo */}
        <Link 
          to={isAuthenticated ? (isAdmin ? "/admin/roles" : (isPastor ? "/pastor/dashboard" : (isLeader ? "/leader/dashboard" : "/member/dashboard"))) : "/"} 
          className="min-w-0 shrink font-serif text-lg sm:text-xl font-bold text-primary tracking-tight transition-opacity hover:opacity-90 truncate"
        >
          DLBC Church Connect
        </Link>

        {/* Structured Linear Workflows - Primary Desktop Nav */}
        <nav aria-label="Primary" className="hidden lg:flex h-full items-center gap-6 lg:gap-8 shrink-0 min-w-[28rem] justify-center">
          {authLoading ? (
            <div className="flex items-center gap-6 lg:gap-8 h-full">
              <div className="h-4 w-20 bg-primary/10 rounded animate-pulse" />
              <div className="h-4 w-24 bg-primary/10 rounded animate-pulse" />
              <div className="h-4 w-20 bg-primary/10 rounded animate-pulse" />
              <div className="h-4 w-24 bg-primary/10 rounded animate-pulse" />
            </div>
          ) : (
            activeMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => {
                  const isCustomActive = 
                    (item.path === '/member/sanctuary' && isMemberDetail) ||
                    (item.path === '/pastor/sanctuary' && isPastorDetail);
                  const isCustomInactive = item.path === '/member/request' && isMemberDetail;
                  const active = (isActive || isCustomActive) && !isCustomInactive;

                  return `inline-flex h-full items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium tracking-widest uppercase transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-primary-muted hover:text-primary"
                  }`;
                }}
              >
                {item.name}
              </NavLink>
            ))
          )}
        </nav>

        {/* Identity State Actions Panel */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 justify-end">
          {authLoading ? (
            <div className="h-9 w-20 sm:w-28 bg-primary/10 rounded-md animate-pulse" />
          ) : !isAuthenticated ? (
            <Link 
              to="/auth/login" 
              className="bg-primary text-white text-xs sm:text-sm font-medium px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-md shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all font-sans whitespace-nowrap flex items-center justify-center shrink-0 min-h-[36px] sm:min-h-[42px]"
            >
              <span className="hidden min-[440px]:inline">Begin Consultation</span>
              <span className="min-[440px]:hidden">Consult</span>
            </Link>
          ) : (
            <button 
              onClick={handleSignOut} 
              className="text-xs sm:text-sm font-medium text-primary-muted hover:text-primary transition-colors font-sans cursor-pointer whitespace-nowrap px-2.5 py-1.5 rounded-md hover:bg-surface-dim min-h-[36px] sm:min-h-[42px] flex items-center justify-center"
            >
              Log Out
            </button>
          )}

          {/* Mobile Hamburger Toggle for < lg */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-primary hover:bg-surface-dim active:bg-surface-dim/80 rounded-lg transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            {mobileMenuOpen ? (
              <X size={22} className="shrink-0" />
            ) : (
              <Menu size={22} className="shrink-0" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Nav Overlay & Drawer for screens < lg */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 top-16 z-40 bg-black/25 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Menu */}
          <div
            id="mobile-nav-menu"
            className="fixed inset-x-0 top-16 z-50 bg-background border-b border-[#ebdcd0] p-4 sm:p-6 shadow-xl lg:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <nav aria-label="Mobile Navigation" className="flex flex-col gap-1.5">
              {activeMenu.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => {
                    const isCustomActive = 
                      (item.path === '/member/sanctuary' && isMemberDetail) ||
                      (item.path === '/pastor/sanctuary' && isPastorDetail);
                    const isCustomInactive = item.path === '/member/request' && isMemberDetail;
                    const active = (isActive || isCustomActive) && !isCustomInactive;

                    return `flex items-center min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm font-medium uppercase tracking-wider transition-colors ${
                      active
                        ? "bg-surface text-primary font-semibold border border-outline shadow-xs"
                        : "text-primary-muted hover:text-primary hover:bg-surface-dim"
                    }`;
                  }}
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {/* Mobile Action Section */}
            <div className="mt-4 pt-4 border-t border-[#ebdcd0]">
              {!isAuthenticated ? (
                <Link
                  to="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center min-h-[44px] px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg shadow-sm hover:bg-primary/90 transition-colors font-sans uppercase tracking-wider"
                >
                  Begin Consultation
                </Link>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {user?.displayName && (
                    <div className="px-2 py-1 text-xs text-primary-muted font-sans flex items-center justify-between">
                      <span>Signed in as <strong className="text-primary">{user.displayName}</strong></span>
                      <span className="capitalize font-semibold text-secondary">{role || 'Member'}</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full flex items-center justify-center min-h-[44px] px-4 py-2.5 border border-control text-primary hover:bg-surface-dim text-sm font-medium rounded-lg transition-colors font-sans uppercase tracking-wider cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
