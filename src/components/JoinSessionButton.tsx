'use client';

import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { getGoogleAccessToken, requestGoogleAccessToken } from '../lib/googleMeetClient';
import { Sparkles, Video, AlertCircle, Check, Key } from 'lucide-react';

export interface JoinSessionButtonProps {
  consultationId: string;
  initialMeetingLink?: string | null;
  className?: string;
  buttonText?: string;
  loadingText?: string;
  icon?: React.ReactNode;
  showTestButton?: boolean;
  onJoinSuccess?: (url: string) => void;
}

export default function JoinSessionButton({
  consultationId,
  initialMeetingLink,
  className,
  buttonText = 'Enter Session Room',
  loadingText = 'Connecting to Room...',
  icon,
  showTestButton = true,
  onJoinSuccess,
}: JoinSessionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSuccessUrl, setTestSuccessUrl] = useState<string | null>(null);

  const handleJoin = async (isTestMode = false, explicitToken?: string) => {
    if (isTestMode) {
      setTestLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setTestSuccessUrl(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const googleAccessToken = explicitToken || getGoogleAccessToken();
      const res = await fetch('/api/consultations/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          consultationId,
          isTestAccess: isTestMode,
          googleAccessToken,
          storedMeetingLink: initialMeetingLink || null,
        }),
      });

      let data: any = null;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        console.warn('Non-JSON response from /api/consultations/join:', responseText);
        // Fallback to initialMeetingLink if available from the database
        if (initialMeetingLink && initialMeetingLink.trim()) {
          const meetingUrl = initialMeetingLink.trim();
          if (onJoinSuccess) onJoinSuccess(meetingUrl);
          if (isTestMode) setTestSuccessUrl(meetingUrl);
          window.open(meetingUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        const cleanMsg = responseText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error(
          res.ok
            ? 'Invalid response format from server.'
            : (cleanMsg.length > 0 && cleanMsg.length < 120 ? cleanMsg : `Server error (${res.status}). Please retry.`)
        );
      }

      if (!res.ok || !data.success) {
        if (initialMeetingLink && initialMeetingLink.trim()) {
          const meetingUrl = initialMeetingLink.trim();
          if (onJoinSuccess) onJoinSuccess(meetingUrl);
          if (isTestMode) setTestSuccessUrl(meetingUrl);
          window.open(meetingUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        throw new Error(data.error || 'Failed to enter session room.');
      }

      const meetingUrl = data.url || data.meetingLink || data.meetUrl || initialMeetingLink || 'https://meet.google.com/new';
      if (!meetingUrl) {
        throw new Error('No valid meeting link was returned.');
      }

      if (onJoinSuccess) onJoinSuccess(meetingUrl);
      if (isTestMode) {
        setTestSuccessUrl(meetingUrl);
      }
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.warn('Failed to enter session room:', err?.message || err);
      setError(err.message || 'Unable to join consultation session');
    } finally {
      setLoading(false);
      setTestLoading(false);
    }
  };

  const handleAuthorizeAndRetry = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await requestGoogleAccessToken();
      if (token) {
        await handleJoin(false, token);
      } else {
        setError('Google authorization was cancelled or failed.');
      }
    } catch (authErr: any) {
      setError(authErr?.message || 'Google authorization failed');
    } finally {
      setLoading(false);
    }
  };

  const buttonClasses = className || "bg-[#1e232a] text-white px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider disabled:opacity-50 hover:bg-[#2c323b] transition-colors cursor-pointer";

  return (
    <div className="flex flex-col items-start gap-2">
      {error && (
        <div className="flex flex-col items-start gap-1.5 text-xs text-red-200 bg-red-950/70 border border-red-500/40 p-3 rounded-md font-sans max-w-md">
          <div className="flex items-center gap-1.5 font-semibold text-red-300">
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          {(error.toLowerCase().includes('writer access') || error.toLowerCase().includes('permission') || error.toLowerCase().includes('google') || error.toLowerCase().includes('unauthorized')) && (
            <div className="pl-5 space-y-1.5">
              <p className="text-[11px] text-white/80">
                You can authorize with your Google account to manage calendar sessions directly.
              </p>
              <button
                type="button"
                onClick={handleAuthorizeAndRetry}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-semibold border border-white/20 cursor-pointer transition-colors"
              >
                <Key size={12} />
                <span>Authorize Google & Enter Room</span>
              </button>
            </div>
          )}
        </div>
      )}

      {testSuccessUrl && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-md font-sans">
          <Check size={13} className="text-emerald-400 shrink-0" />
          <span>Room opened: <strong className="font-mono">{testSuccessUrl}</strong></span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Primary Enter Session Room Button */}
        <button
          onClick={() => handleJoin(false)}
          disabled={loading || testLoading}
          className={buttonClasses}
        >
          <span className="inline-flex items-center gap-1.5">
            {icon || <Video size={16} />}
            <span>{loading ? loadingText : buttonText}</span>
          </span>
        </button>

        {/* Test Room Button to test meeting stored in database immediately */}
        {showTestButton && (
          <button
            onClick={() => handleJoin(true)}
            disabled={testLoading || loading}
            type="button"
            title="Test Room: opens the meeting link stored in the database"
            className="inline-flex items-center gap-1.5 bg-[#1c202e]/10 hover:bg-[#1c202e]/20 text-[#1c202e] border border-[#1c202e]/20 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Sparkles size={13} className="shrink-0 text-amber-600" />
            <span>{testLoading ? 'Testing Room...' : 'Test Room'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

