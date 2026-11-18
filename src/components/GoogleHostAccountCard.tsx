import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Video, CheckCircle2, RefreshCw, Link2 } from 'lucide-react';
import { useToast } from './ui/ToastProvider';

export function GoogleHostAccountCard() {
  const { user, getIdToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; email?: string | null; connectedAt?: string | null }>({
    connected: false,
  });

  const fetchStatus = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const idToken = await getIdToken();
      if (!idToken) return;
      const res = await fetch('/api/google/status', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch Google host account status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const handleConnect = async () => {
    if (!user || connecting) return;
    try {
      setConnecting(true);
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated. Please log in again.');
      }
      const res = await fetch('/api/google/connect', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Unable to initiate Google connection. Check server OAuth settings.');
      }
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Google connect error:', err);
      showToast({
        variant: 'error',
        title: 'Google Connection Failed',
        message: err.message || 'Failed to start Google connection.',
      });
      setConnecting(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-primary/10 pb-3">
        <div className="flex items-center gap-2.5 text-primary min-w-0">
          <Video size={18} className="text-primary-muted shrink-0" />
          <h2 className="font-serif text-xl text-primary truncate">Google Meet Host</h2>
        </div>
        {status.connected && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 whitespace-nowrap shrink-0">
            <CheckCircle2 size={12} className="text-emerald-600" /> Active Host
          </span>
        )}
      </div>

      <p className="font-sans text-xs text-primary-muted leading-relaxed mb-5">
        Consultation video rooms generate automatically via the central pastoral office. Personal linking is optional.
      </p>

      {loading ? (
        <div className="py-4 flex items-center justify-center text-xs text-primary-muted animate-pulse">
          Checking connection status...
        </div>
      ) : status.connected ? (
        <div className="space-y-4">
          <div className="bg-surface-dim/70 rounded-lg p-3.5 border border-primary/10">
            <span className="block text-[11px] font-sans font-semibold uppercase tracking-wider text-primary-muted mb-1">
              Connected Account
            </span>
            <span className="font-mono text-sm text-primary font-semibold block truncate">
              {status.email}
            </span>
            {status.connectedAt && (
              <span className="block text-[10px] text-primary-subtle mt-1">
                Connected on {new Date(status.connectedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full inline-flex min-h-[42px] items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-surface hover:bg-primary/5 text-primary border border-primary/15 font-sans text-xs font-semibold tracking-wider transition-colors cursor-pointer active-sink disabled:opacity-50"
          >
            <RefreshCw size={13} className={connecting ? 'animate-spin' : ''} />
            <span>{connecting ? 'Redirecting to Google...' : 'Reconnect Host Account'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-dim/70 px-3.5 py-2.5 border border-primary/10">
            <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-primary">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
              <span>Central Pastoral Office Active</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full inline-flex min-h-[42px] items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-primary/15 bg-surface hover:bg-primary/5 text-primary font-sans text-xs font-semibold tracking-wider transition-colors cursor-pointer active-sink disabled:opacity-50"
          >
            <Link2 size={14} />
            <span>{connecting ? 'Connecting to Google...' : 'Link Personal Google Account (Optional)'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
