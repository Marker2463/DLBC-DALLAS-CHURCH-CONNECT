import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  connectPastorGoogleCalendar,
  getPastorGoogleCalendarStatus,
} from '../lib/googleMeetClient';
import {
  Calendar,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Info,
  ArrowLeft,
} from 'lucide-react';
import { QuoteInline } from '../components/Quotes';
import { Popover } from '../components/ui/Popover';
import { useToast } from '../components/ui/ToastProvider';

export default function Settings() {
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const googleCalendarQuery = searchParams.get('googleCalendar');

  const [connecting, setConnecting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [status, setStatus] = useState<{
    connected: boolean;
    email?: string | null;
    connectedAt?: string | null;
  }>({ connected: false });

  const isLeaderOrPastor =
    userProfile?.role === 'pastor' ||
    userProfile?.role === 'leader' ||
    userProfile?.role === 'admin';

  useEffect(() => {
    if (!googleCalendarQuery) return;

    if (googleCalendarQuery === 'connected') {
      showToast({
        variant: 'success',
        title: 'Google Calendar Connected',
        message:
          'Your personal Google Calendar is now authorized for hosting consultation meetings.',
      });
    } else if (googleCalendarQuery === 'wrong-account') {
      showToast({
        variant: 'warning',
        title: 'Account Email Mismatch',
        message: `Please authorize using your registered DLBC email (${user?.email || 'your account email'}).`,
      });
    } else {
      showToast({
        variant: 'error',
        title: 'Authorization Not Completed',
        message: `Google Calendar authorization failed or was cancelled (${googleCalendarQuery}).`,
      });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('googleCalendar');
    setSearchParams(nextParams, { replace: true });
  }, [googleCalendarQuery, searchParams, setSearchParams, showToast, user?.email]);

  const fetchStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await getPastorGoogleCalendarStatus();
      setStatus(res);
    } catch (err: any) {
      console.warn('Failed to fetch Google Calendar status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (user && isLeaderOrPastor) {
      fetchStatus();
    } else {
      setCheckingStatus(false);
    }
  }, [user, isLeaderOrPastor]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectPastorGoogleCalendar();
    } catch (err: any) {
      showToast({
        variant: 'error',
        title: 'Authorization Failed',
        message: err.message || 'Failed to start Google Calendar authorization.',
      });
      setConnecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 md:py-16 pb-28 sm:pb-32">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to={isLeaderOrPastor ? '/pastor/dashboard' : '/member/dashboard'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors min-h-[36px]"
        >
          <ArrowLeft size={14} />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl text-primary tracking-tight mb-2">
          Account & Pastoral Settings
        </h1>
        <QuoteInline
          quote="Let all things be done decently and in order."
          citation="1 Corinthians 14:40"
        />
      </div>

      {/* Main Settings Card */}
      <div className="space-y-6 sm:space-y-8">
        {/* User Identity Card */}
        <section className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
          <h2 className="font-serif text-xl text-primary mb-4 flex items-center gap-2">
            <UserCheck size={20} className="text-primary-muted shrink-0" />
            <span>Profile Identity</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-sans">
            <div className="min-w-0">
              <p className="text-xs text-primary-muted font-semibold uppercase tracking-wider mb-1">
                Display Name
              </p>
              <p className="font-semibold text-primary break-words">{user?.displayName || 'User'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-primary-muted font-semibold uppercase tracking-wider mb-1">
                Email Address
              </p>
              <p className="font-mono text-primary break-all">{user?.email || 'None'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-muted font-semibold uppercase tracking-wider mb-1">
                Assigned Role
              </p>
              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary">
                {userProfile?.role || 'member'}
              </span>
            </div>
            <div>
              <p className="text-xs text-primary-muted font-semibold uppercase tracking-wider mb-1">
                Account Status
              </p>
              <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 size={14} /> Active & Verified
              </span>
            </div>
          </div>
        </section>

        {/* Google Calendar Connection Card (Pastors & Leaders Only) */}
        {isLeaderOrPastor ? (
          <section className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-primary/10 pb-5 mb-6">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Calendar size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-xl text-primary leading-snug">
                    Google Calendar &amp; Meet Hosting
                  </h2>
                  <p className="text-xs text-primary-muted mt-0.5">
                    Optional personal linking — meetings auto-provision via the central pastoral office
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {checkingStatus ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary-muted">
                    <RefreshCw size={13} className="animate-spin" /> Checking status...
                  </span>
                ) : status.connected ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Personal Account Linked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Pastoral Office Active
                  </span>
                )}

                <Popover
                  title="How Consultation Meetings Work"
                  triggerLabel="How it works"
                  align="right"
                  widthClass="sm:w-96"
                  triggerContent={
                    <>
                      <ShieldCheck size={14} className="shrink-0 text-emerald-700" />
                      <span>How it works</span>
                    </>
                  }
                >
                  <p>
                    Pastoral consultation rooms are created seamlessly with direct member access (`OPEN`) so congregants enter without waiting for manual admission:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>If your personal Google account is not linked, DLBC automatically provisions the meeting through the central pastoral office calendar.</li>
                    <li>Linking your personal Google account is optional and inserts events onto your personal primary calendar instead.</li>
                  </ul>
                </Popover>
              </div>
            </div>

            <div className="space-y-4">
              {status.connected ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 font-sans space-y-1">
                    <p className="break-all">
                      <strong>Connected Account:</strong>{' '}
                      <span className="font-mono">{status.email || user?.email}</span>
                    </p>
                    {status.connectedAt && (
                      <p className="text-emerald-800">
                        <strong>Authorized:</strong>{' '}
                        {new Date(status.connectedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/20 hover:bg-primary/5 text-primary text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <RefreshCw size={14} className={connecting ? 'animate-spin' : ''} />
                      <span>{connecting ? 'Redirecting to Google...' : 'Reconnect Google Calendar'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-dim/60 px-3.5 py-2.5 border border-primary/10">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                      <span>Ready — video consultations generate automatically via the central pastoral office.</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 rounded-lg border border-primary/20 bg-surface hover:bg-primary/5 text-primary text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    <Calendar size={15} />
                    <span>{connecting ? 'Redirecting to Google...' : 'Connect Personal Google Calendar (Optional)'}</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
            <div className="flex items-start gap-3 text-sm text-primary-muted">
              <Info size={18} className="shrink-0 text-primary-muted mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary mb-1">Congregational Membership</h3>
                <p className="text-xs leading-relaxed">
                  Meeting links for your scheduled spiritual consultations appear directly in your Member Sanctuary dashboard and session detail pages.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
