import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Check, 
  Video, 
  CheckCircle2, 
  Loader2, 
  Calendar as CalendarIcon, 
  ExternalLink,
  Copy,
  MapPin,
  X
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { db, Consultation } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { generateGoogleCalendarUrl } from '../../lib/calendarHelper';
import { getOrInitializeMeetUrl } from '../../lib/appointmentService';
import JoinSessionButton from '../../components/JoinSessionButton';
import { formatDateTime, getInitials, formatMeetingMethod } from '../../lib/canonical';
import { CancelConsultationModal } from '../../components/CancelConsultationModal';
import { useToast } from '../../components/ui/ToastProvider';

// Shared Consultation Components
import { 
  ConsultationDetailLayout, 
  PageHeader, 
  Card, 
  MetaRow, 
  Timeline, 
  calculateJoinState,
  BUFFER_MINUTES_BEFORE_START 
} from '../../components/consultation';

export function PastorRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Meeting finalization & confirmation state
  const [isSubmittingFinalize, setIsSubmittingFinalize] = useState(false);

  // Meeting copy state
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!id || !user) {
      if (!user) setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'consultations', id),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Consultation;
          const consultObj = { ...data, id: docSnap.id };
          setConsultation(consultObj);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Pastor consultation subscription error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id, user]);

  const rawMeetingLink = consultation?.meetUrl || consultation?.googleMeetUrl || consultation?.meetingLink || (consultation as any)?.meeting?.url;
  const meetingLink = rawMeetingLink ? rawMeetingLink.trim() : null;

  const scheduledTimeIso = consultation?.scheduledStart || consultation?.selectedTime;
  const joinState = calculateJoinState(
    consultation?.status,
    scheduledTimeIso,
    consultation?.scheduledEnd,
    consultation?.durationMinutes || 45,
    now,
    BUFFER_MINUTES_BEFORE_START
  );

  /**
   * Finalize & Confirm Consultation with Exact Requested Details
   */
  const handleFinalizeMeeting = async () => {
    if (!consultation || !id) return;
    setIsSubmittingFinalize(true);

    try {
      const selectedIso = consultation.selectedTime || consultation.scheduledStart || new Date().toISOString();
      const startTime = new Date(selectedIso);
      const endTime = new Date(startTime.getTime() + 45 * 60000);
      const reqMethod = consultation.meetingMethod || 'google_meet';

      const formattedReadable = formatDateTime(selectedIso, 'long');

      const updatedTimeline = [
        ...(consultation.journeyTimeline || []),
        {
          status: 'Pastor Confirmed',
          timestamp: new Date().toISOString(),
          description: `Meeting confirmed for ${formattedReadable} (${reqMethod === 'in_person' ? 'In-Person' : formatMeetingMethod(reqMethod)}).`
        }
      ];

      await updateDoc(doc(db, 'consultations', id), {
        status: 'scheduled',
        isLocked: true,
        selectedTime: selectedIso,
        scheduledStart: selectedIso,
        scheduledEnd: endTime.toISOString(),
        meetingMethod: reqMethod,
        meetingLocation: reqMethod === 'in_person' ? (consultation.meetingLocation || 'DLBC Church Sanctuary / Pastoral Suite') : null,
        journeyTimeline: updatedTimeline,
        updatedAt: new Date().toISOString()
      });

      showToast({
        variant: 'success',
        title: 'Appointment Confirmed',
        message: 'The consultation has been finalized and added to the schedule.',
      });
    } catch (err) {
      console.error("Failed to finalize meeting:", err);
      showToast({
        variant: 'error',
        title: 'Confirmation Failed',
        message: 'Failed to confirm appointment. Please try again.',
      });
    } finally {
      setIsSubmittingFinalize(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!consultation || !id) return;
    try {
      await updateDoc(doc(db, 'consultations', id), {
        status: 'completed',
        journeyTimeline: [
          ...(consultation.journeyTimeline || []),
          { 
            status: 'Completed', 
            timestamp: new Date().toISOString(), 
            description: 'The pastoral consultation session has concluded.' 
          }
        ]
      });
      showToast({
        variant: 'success',
        title: 'Session Completed',
        message: 'Consultation has been marked as completed.',
      });
    } catch (err) {
      console.error("Failed to mark consultation completed:", err);
      showToast({
        variant: 'error',
        title: 'Update Failed',
        message: 'Unable to update consultation status. Please try again.',
      });
    }
  };

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const handleConfirmCancel = async (reason: string) => {
    if (!consultation || !id) return;
    setIsSubmittingFinalize(true);
    try {
      const res = await fetch('/api/consultations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: id,
          cancelledBy: 'leader',
          cancellationReason: reason,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to cancel consultation.");
      }
      showToast({
        variant: 'info',
        title: 'Consultation Cancelled',
        message: 'The consultation request has been cancelled.',
      });
    } catch (err: unknown) {
      console.error("Failed to cancel consultation:", err);
      throw err;
    } finally {
      setIsSubmittingFinalize(false);
    }
  };

  const handleCopyLink = () => {
    if (!meetingLink) return;
    navigator.clipboard.writeText(meetingLink);
    setCopiedLink(true);
    showToast({
      variant: 'success',
      title: 'Link Copied',
      message: 'Google Meet URL copied to clipboard.',
      duration: 3000,
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] bg-[#faf8f5]">
        <Loader2 className="animate-spin text-primary/40" size={40} />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-[#faf8f5]">
        <h1 className="font-serif text-3xl text-primary mb-3">Consultation Not Found</h1>
        <p className="font-sans text-sm text-primary-muted max-w-md mb-6">
          The requested pastoral consultation record could not be found or has been archived.
        </p>
        <button
          onClick={() => navigate('/pastor/dashboard')}
          className="px-5 py-2.5 bg-primary text-white rounded-lg font-sans text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isConfirmed = consultation.status === 'scheduled' || consultation.status === 'completed';
  const googleCalUrl = generateGoogleCalendarUrl(consultation);

  // 1. Page Header (shared component)
  const pageHeader = (
    <PageHeader
      role="pastor"
      consultationId={consultation.id}
      category={consultation.category}
      personName={consultation.memberName}
      status={consultation.status}
      dashboardUrl="/pastor/dashboard"
    />
  );

  // 2. Dark Hero Card
  const heroCard = (
    <>
      {/* Primary Action Card: If Not Yet Confirmed */}
      {!isConfirmed && consultation.status !== 'cancelled' && (
        <div className="bg-[#1c202e] rounded-2xl p-5 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-serif text-2xl sm:text-3xl text-white mb-3">
              Confirm &amp; Finalize This Meeting
            </h2>
            
            <p className="font-sans text-sm text-stone-300 leading-relaxed mb-6 max-w-2xl">
              Confirm the requested appointment details and format to finalize the session.
            </p>

            <div className="bg-white/10 rounded-xl p-4 sm:p-5 border border-white/15 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm font-sans">
              <div>
                <span className="block text-xs uppercase tracking-wider text-stone-300 font-semibold mb-1">Requested Date &amp; Time</span>
                <span className="font-bold text-white text-base">
                  {consultation.selectedTime 
                    ? formatDateTime(consultation.selectedTime, 'long')
                    : 'No specific time selected'}
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-stone-300 font-semibold mb-1">Requested Format</span>
                <span className="font-medium text-white/95 capitalize flex items-center gap-1.5">
                  {consultation.meetingMethod === 'in_person' ? (
                    <>
                      <MapPin size={14} className="text-stone-300 shrink-0" />
                      {formatMeetingMethod(consultation.meetingMethod)} ({consultation.meetingLocation || 'Sanctuary / Office'})
                    </>
                  ) : (
                    <>
                      <Video size={14} className="text-stone-300 shrink-0" />
                      {formatMeetingMethod(consultation.meetingMethod)} Video Call
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleFinalizeMeeting}
                disabled={isSubmittingFinalize}
                className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[#1c202e] hover:bg-white/90 font-sans text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-md active-sink cursor-pointer disabled:opacity-50"
              >
                {isSubmittingFinalize ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-primary" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-700" />
                    <span>Confirm Requested Appointment</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={isSubmittingFinalize}
                className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-sans text-sm font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
                <span>Cancel Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed Active Meeting Card */}
      {isConfirmed && (
        <div className={`rounded-2xl p-5 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden ${
          joinState === 'ended' ? 'bg-[#252834]' : 'bg-[#1c202e]'
        }`}>
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-stone-300 font-semibold">
                {joinState === 'ended' ? (
                  <span>SESSION ENDED</span>
                ) : consultation.meetingMethod === 'in_person' ? (
                  <>
                    <MapPin size={15} className="text-stone-300" />
                    <span>{formatMeetingMethod(consultation.meetingMethod)} Consultation</span>
                  </>
                ) : (
                  <>
                    <Video size={15} className="text-stone-300" />
                    <span>{formatMeetingMethod(consultation.meetingMethod)} Consultation</span>
                  </>
                )}
              </div>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl text-white mb-2 break-words">
              Session with {consultation.memberName || 'Member'}
            </h2>

            <p className="font-sans text-sm text-stone-300 mb-6">
              {consultation.selectedTime 
                ? formatDateTime(consultation.selectedTime, 'long')
                : 'Time pending'}
            </p>

            {/* Google Meet & Calendar Actions */}
            <div className="bg-white/5 rounded-xl p-4 sm:p-6 border border-white/10 space-y-4">
              {consultation.meetingMethod === 'in_person' ? (
                <div className="flex items-center gap-3">
                  <MapPin size={20} className="text-stone-300 shrink-0" />
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-stone-300 font-semibold">Location</span>
                    <span className="font-semibold text-white text-base">
                      {consultation.meetingLocation || 'DLBC Church Sanctuary / Pastoral Suite'}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="block text-xs uppercase tracking-wider text-stone-300 font-semibold mb-2">
                    Official Google Meet Link
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="bg-black/30 px-3.5 py-2.5 rounded-lg border border-white/10 text-white font-mono text-xs sm:text-sm select-all flex-grow min-w-0 truncate">
                      {meetingLink || 'Meeting link will be activated once scheduled'}
                    </div>

                    {meetingLink && (
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="min-h-[44px] w-full sm:w-auto px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/15 shrink-0"
                      >
                        {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                {/* Direct Launch for Online Meetings */}
                {consultation.meetingMethod !== 'in_person' && joinState !== 'ended' && (
                  <JoinSessionButton
                    consultationId={consultation.id}
                    initialMeetingLink={meetingLink}
                    buttonText="Start & Host Meeting"
                    loadingText="Connecting..."
                    role="pastor"
                    icon={<Video size={16} />}
                    showTestButton={false}
                    className="min-h-[44px] w-full sm:w-auto bg-white text-[#1c202e] hover:bg-white/90 px-6 py-3 rounded-xl font-sans text-sm font-bold flex items-center justify-center gap-2 transition-colors active-sink cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  />
                )}

                {/* 1-Click Google Calendar Sync */}
                <a
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-sans text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-white/20 cursor-pointer whitespace-nowrap"
                >
                  <CalendarIcon size={16} />
                  <span>Add to Google Calendar</span>
                  <ExternalLink size={14} className="text-stone-300" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // 3. Member's Reason & Details Card (main column, below hero)
  const reasonCard = (
    <Card className="p-6 sm:p-8">
      <h2 className="font-serif text-2xl text-primary mb-6">
        Member's Reason for Consultation
      </h2>
      
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-surface-dim flex items-center justify-center font-sans font-semibold text-primary shrink-0 uppercase text-sm border border-primary/10">
          {getInitials(consultation.memberName)}
        </div>
        <div>
          <h3 className="font-sans text-base font-semibold text-primary">{consultation.memberName}</h3>
          <p className="font-sans text-xs text-primary-muted">
            {consultation.memberEmail || 'Member'}
          </p>
        </div>
      </div>

      <div className="prose prose-sm font-sans text-primary mb-8 border-l-2 border-primary/20 pl-6 py-2 italic whitespace-pre-wrap bg-[#faf8f5] rounded-r-lg">
        "{consultation.reason && consultation.reason.trim() && consultation.reason !== 'No description provided.'
          ? consultation.reason 
          : 'No additional details provided.'}"
      </div>
      
      <MetaRow
        urgency={consultation.urgency}
        category={consultation.category}
        stage={consultation.status}
      />
    </Card>
  );

  // 4. Sidebar Card 1: Pastoral Controls
  const sessionControls = (
    <Card className="p-6">
      <h2 className="font-sans text-sm font-semibold text-primary mb-4 border-b border-primary/10 pb-2">
        Pastoral Controls
      </h2>
      
      <div className="space-y-3">
        {!isConfirmed && consultation.status !== 'cancelled' && (
          <button
            type="button"
            onClick={handleFinalizeMeeting}
            disabled={isSubmittingFinalize}
            className="w-full min-h-[44px] bg-[#1c202e] hover:bg-[#1c202e]/90 text-white py-3 px-4 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active-sink cursor-pointer disabled:opacity-50"
          >
            {isSubmittingFinalize ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-400" />
            )}
            <span>Confirm Appointment</span>
          </button>
        )}

        {consultation.status !== 'cancelled' && consultation.status !== 'completed' && (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            disabled={isSubmittingFinalize}
            className="w-full min-h-[44px] bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-stone-300 cursor-pointer disabled:opacity-50"
          >
            <X size={16} />
            <span>Cancel Consultation</span>
          </button>
        )}

        {isConfirmed && consultation.status !== 'completed' && consultation.status !== 'cancelled' && (
          <button 
            type="button"
            onClick={handleMarkCompleted} 
            className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-white py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 active-sink cursor-pointer"
          >
            <Check size={16} />
            <span>Mark as Completed</span>
          </button>
        )}

        <a
          href={googleCalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[44px] bg-surface hover:bg-primary/5 text-primary py-3 px-4 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-primary/10 cursor-pointer"
        >
          <CalendarIcon size={16} />
          <span>Add to Google Calendar</span>
        </a>
      </div>
    </Card>
  );

  // 5. Sidebar Card 2: CONSULTATION JOURNEY
  const journeyTimeline = (
    <Card className="p-6">
      <h2 className="font-sans text-xs text-primary-muted uppercase tracking-widest font-semibold mb-6">
        CONSULTATION JOURNEY
      </h2>
      
      <Timeline
        events={consultation.journeyTimeline || []}
        originallyRequestedTime={(consultation as any).originallyRequestedTime}
      />
    </Card>
  );

  return (
    <>
      <ConsultationDetailLayout
        role="pastor"
        pageHeader={pageHeader}
        heroCard={heroCard}
        sessionControls={sessionControls}
        reasonCard={reasonCard}
        journeyTimeline={journeyTimeline}
      />

      <CancelConsultationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        role="leader"
        consultationCategory={consultation.category}
      />
    </>
  );
}
