import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Video, FileText, MapPin } from 'lucide-react';
import { Consultation } from '../lib/firebase';
import JoinSessionButton from './JoinSessionButton';
import { formatDateTime, formatMeetingMethod, getNearestUpcomingConsultation } from '../lib/canonical';

interface UpcomingConsultationBannerProps {
  session?: Consultation | null;
  consultations?: Consultation[];
  role: 'member' | 'pastor' | 'leader';
  loading?: boolean;
}

export function UpcomingConsultationBanner({
  session,
  consultations,
  role,
  loading,
}: UpcomingConsultationBannerProps) {
  // Re-evaluate on a 60-second interval so the banner rolls to the next session when current one ends
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return null;
  }

  // Determine active candidate consultation
  const activeSession = session !== undefined
    ? session
    : (consultations ? getNearestUpcomingConsultation(consultations, nowMs) : null);

  // If no consultation qualifies, do not render the banner at all
  if (!activeSession) {
    return null;
  }

  const caseRecordLink = role === 'member' 
    ? `/member/request/${activeSession.id}` 
    : `/pastor/request/${activeSession.id}`;

  const otherPartyName = role === 'member'
    ? (activeSession.leaderName || 'Pastoral Team')
    : (activeSession.memberName || 'Congregant');

  const scheduledTimeStr = activeSession.scheduledStart || activeSession.selectedTime;

  return (
    <div className="bg-[#1c202e] rounded-xl p-6 md:p-8 mb-10 shadow-xl relative overflow-hidden text-white border border-white/10">
      {/* Ambient background highlight */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20 shadow-inner">
            {activeSession.meetingMethod === 'in_person' ? (
              <MapPin size={26} className="text-white/90" />
            ) : (
              <Video size={26} className="text-white/90" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-white/15 border border-white/20 text-white">
                UPCOMING
              </span>
              
              <span className="text-white/60 font-sans text-xs">
                {formatMeetingMethod(activeSession.meetingMethod)}
              </span>
            </div>

            <h2 className="font-serif text-2xl md:text-3xl text-white mb-1.5">
              {activeSession.category || 'Spiritual Guidance'}
            </h2>

            <p className="font-sans text-sm text-white/80 leading-relaxed max-w-xl">
              Private pastoral consultation with <strong className="text-white font-semibold">{otherPartyName}</strong>.
              {scheduledTimeStr && (
                <span className="block mt-1 text-white/70">
                  Scheduled for {formatDateTime(scheduledTimeStr, 'long')}
                  {activeSession.meetingMethod === 'in_person' && (
                    <> • Location: {activeSession.meetingLocation || 'Sanctuary / Office'}</>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Suite with Join Room & Open Case Record */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {activeSession.meetingMethod !== 'in_person' && (
            <JoinSessionButton
              consultationId={activeSession.id}
              initialMeetingLink={activeSession.meetingLink || activeSession.meetUrl || activeSession.googleMeetUrl}
              buttonText="Enter Session Room"
              loadingText="Connecting..."
              icon={<Video size={16} />}
              className="inline-flex items-center gap-2 bg-white text-[#1c202e] hover:bg-white/90 font-sans text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-lg transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-75"
            />
          )}

          <Link
            to={caseRecordLink}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-semibold uppercase tracking-wider px-4 py-3 rounded-lg transition-colors border border-white/20 cursor-pointer"
          >
            <FileText size={15} />
            Open Case Record
          </Link>
        </div>
      </div>
    </div>
  );
}

export default UpcomingConsultationBanner;

