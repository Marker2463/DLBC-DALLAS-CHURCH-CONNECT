import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Check, 
  Lock, 
  Clock, 
  ChevronRight, 
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
import { createGoogleMeetSpace } from '../../lib/googleMeetClient';
import { getOrInitializeMeetUrl, isSyntheticMeetUrl } from '../../lib/appointmentService';
import JoinSessionButton from '../../components/JoinSessionButton';
import { formatDateTime, getInitials, formatMeetingMethod, buttonSizes, buttonTokens, tertiaryLinkClass } from '../../lib/canonical';
import { StatusBadge } from '../../components/StatusBadge';
import { CancelConsultationModal } from '../../components/CancelConsultationModal';

export function PastorRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Meeting finalization & confirmation state
  const [isSubmittingFinalize, setIsSubmittingFinalize] = useState(false);
  const [finalizeSuccessMessage, setFinalizeSuccessMessage] = useState("");
  const [finalizeErrorMessage, setFinalizeErrorMessage] = useState("");

  // Meeting join & copy state
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
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

  const getJoinState = (consultation: Consultation | null) => {
    if (!consultation) return 'upcoming';
    if (consultation.status !== 'scheduled' && consultation.status !== 'completed') return 'upcoming';
    
    const startTimeStr = consultation.scheduledStart || consultation.selectedTime;
    if (!startTimeStr) return 'upcoming';

    const startTime = new Date(startTimeStr);
    const endTimeStr = consultation.scheduledEnd;
    const endTime = endTimeStr ? new Date(endTimeStr) : new Date(startTime.getTime() + 45 * 60000);
    const bufferStart = new Date(startTime.getTime() - 10 * 60000); // 10 mins before

    if (now > endTime || consultation.status === 'completed') return 'ended';
    if (now >= bufferStart) return 'joinable';
    return 'upcoming';
  };

  const joinState = getJoinState(consultation);
  const rawMeetingLink = consultation?.meetUrl || consultation?.googleMeetUrl || consultation?.meetingLink || (consultation as any)?.meeting?.url;
  const meetingLink = rawMeetingLink ? rawMeetingLink.trim() : null;

  /**
   * Finalize & Confirm Consultation with Exact Requested Details
   * Pastors/leaders strictly confirm or cancel the requested details as submitted by the member.
   */
  const handleFinalizeMeeting = async () => {
    if (!consultation || !id) return;
    setIsSubmittingFinalize(true);
    setFinalizeSuccessMessage("");
    setFinalizeErrorMessage("");

    try {
      const selectedIso = consultation.selectedTime || consultation.scheduledStart || new Date().toISOString();
      const startTime = new Date(selectedIso);
      const endTime = new Date(startTime.getTime() + 45 * 60000);
      const reqMethod = consultation.meetingMethod || 'google_meet';

      const formattedReadable = formatDateTime(selectedIso, 'long');

      const updatedTimeline = [
        ...(consultation.journeyTimeline || []),
        {
          status: 'Confirmed & Scheduled',
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

      setFinalizeSuccessMessage("Appointment confirmed successfully.");
    } catch (err) {
      console.error("Failed to finalize meeting:", err);
      setFinalizeErrorMessage("Failed to confirm appointment. Please try again.");
    } finally {
      setIsSubmittingFinalize(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!consultation || !id) return;
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
    setFinalizeSuccessMessage("Consultation marked as completed.");
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
      setFinalizeSuccessMessage("Consultation request has been cancelled.");
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
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleJoinMeeting = async () => {
    if (!id) return;
    if (meetingLink) {
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
      return;
    }
    setIsJoining(true);
    setJoinError("");
    try {
      const url = await getOrInitializeMeetUrl(id, {
        summary: `DLBC Consultation — ${consultation?.category || 'Pastoral Care'}`,
        startIso: consultation?.scheduledStart || consultation?.selectedTime || undefined,
        method: consultation?.meetingMethod
      });
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setJoinError("Unable to initialize session video room.");
      }
    } catch (err: any) {
      console.error("Join error:", err);
      setJoinError("Unable to connect to the session.");
    } finally {
      setIsJoining(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary/30" size={48} />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="max-w-7xl mx-auto px-6 w-full py-12 text-center">
        <h1 className="font-serif text-3xl text-primary">Consultation Not Found</h1>
      </div>
    );
  }

  const isConfirmed = consultation.status === 'scheduled' || consultation.status === 'completed';
  const googleCalUrl = generateGoogleCalendarUrl(consultation);

  return (
    <div className="max-w-7xl mx-auto px-6 w-full py-12 pb-32">
      {/* Top Breadcrumb & Status */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-primary/60 font-sans text-xs uppercase tracking-widest mb-3">
          <button onClick={() => navigate(-1)} className="hover:text-primary transition-colors cursor-pointer">
            Dashboard
          </button>
          <ChevronRight size={12} />
          <span>Consultation {id ? `C-${id.substring(0, 5)}` : ''}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-primary mb-2">
              Consultation: {consultation.category}
            </h1>
            <p className="font-sans text-sm text-primary/60">
              Requested by <strong className="text-primary">{consultation.memberName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={consultation.status} />
          </div>
        </div>
      </div>

      {finalizeSuccessMessage && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 font-sans text-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{finalizeSuccessMessage}</span>
        </div>
      )}

      {finalizeErrorMessage && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 font-sans text-sm">
          <X size={18} className="text-red-600 shrink-0" />
          <span>{finalizeErrorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (Primary Content) */}
        <div className="lg:col-span-8 space-y-8">

          {/* Primary Action Card: If Not Yet Confirmed, Clean Direct Confirmation */}
          {!isConfirmed && consultation.status !== 'cancelled' && (
            <div className="bg-[#1c202e] rounded-2xl p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="font-serif text-2xl md:text-3xl text-white mb-3">
                  Confirm &amp; Finalize This Meeting
                </h2>
                
                <p className="font-sans text-sm text-white/80 leading-relaxed mb-6 max-w-2xl">
                  Confirm the requested appointment details and format to finalize the session.
                </p>

                <div className="bg-white/10 rounded-xl p-5 border border-white/15 mb-6 flex flex-wrap items-center justify-between gap-4 text-sm font-sans">
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-white/60 mb-1">Requested Date &amp; Time</span>
                    <span className="font-semibold text-white text-base">
                      {consultation.selectedTime 
                        ? formatDateTime(consultation.selectedTime, 'long')
                        : 'No specific time selected'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-white/60 mb-1">Requested Format</span>
                    <span className="font-medium text-white/90 capitalize flex items-center gap-1.5">
                      {consultation.meetingMethod === 'in_person' ? (
                        <>
                          <MapPin size={14} className="text-white/80" />
                          {formatMeetingMethod(consultation.meetingMethod)} ({consultation.meetingLocation || 'Sanctuary / Office'})
                        </>
                      ) : (
                        <>
                          <Video size={14} className="text-white/80" />
                          {formatMeetingMethod(consultation.meetingMethod)} Video Call
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleFinalizeMeeting}
                    disabled={isSubmittingFinalize}
                    className="inline-flex items-center justify-center gap-2 bg-white text-[#1c202e] hover:bg-white/90 font-sans text-sm font-bold px-7 py-3.5 rounded-xl transition-all shadow-md active-sink cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingFinalize ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-primary" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-700" />
                        Confirm Requested Appointment
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    disabled={isSubmittingFinalize}
                    className="inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-sans text-sm font-medium px-6 py-3.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X size={16} />
                    Cancel Request
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmed Active Meeting Card */}
          {isConfirmed && (
            <div className={`rounded-2xl p-8 text-white shadow-xl relative overflow-hidden ${
              joinState === 'ended' ? 'bg-[#252834]' : 'bg-[#1c202e]'
            }`}>
              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2 font-sans text-xs uppercase tracking-widest text-white/60 font-semibold">
                    {consultation.meetingMethod === 'in_person' ? (
                      <MapPin size={15} className="text-white/80" />
                    ) : (
                      <Video size={15} className="text-white/80" />
                    )}
                    <span>
                      {formatMeetingMethod(consultation.meetingMethod)} Consultation
                    </span>
                  </div>
                </div>

                <h2 className="font-serif text-2xl md:text-3xl text-white mb-2">
                  Session with {consultation.memberName || 'Member'}
                </h2>

                <p className="font-sans text-sm text-white/80 mb-6">
                  {consultation.selectedTime 
                    ? formatDateTime(consultation.selectedTime, 'long')
                    : 'Time pending'}
                </p>

                {/* Google Meet & Calendar Actions */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
                  {consultation.meetingMethod === 'in_person' ? (
                    <div className="flex items-center gap-3">
                      <MapPin size={20} className="text-[#ffb3ae] shrink-0" />
                      <div>
                        <span className="block text-xs uppercase tracking-wider text-white/60">Location</span>
                        <span className="font-semibold text-white text-base">
                          {consultation.meetingLocation || 'DLBC Church Sanctuary / Pastoral Suite'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-white/60 mb-2">
                        Official Google Meet Link
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-black/30 px-4 py-2.5 rounded-lg border border-white/10 text-white font-mono text-sm select-all flex-grow max-w-md truncate">
                          {meetingLink || 'Meeting link will be activated once scheduled'}
                        </div>

                        {meetingLink && (
                          <button
                            onClick={handleCopyLink}
                            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {copiedLink ? 'Copied' : 'Copy Link'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-4">
                    {/* Direct Launch for Online Meetings */}
                    {consultation.meetingMethod !== 'in_person' && (
                      <JoinSessionButton
                        consultationId={consultation.id}
                        initialMeetingLink={meetingLink}
                        buttonText="Enter Session Room"
                        loadingText="Connecting..."
                        icon={<Video size={16} />}
                        className="bg-white text-[#1c202e] hover:bg-white/90 px-6 py-3 rounded-lg font-sans text-sm font-bold flex items-center justify-center gap-2 transition-colors active-sink cursor-pointer disabled:opacity-50"
                      />
                    )}

                    {/* 1-Click Google Calendar Sync */}
                    <a
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-lg font-sans text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-white/15 cursor-pointer"
                    >
                      <CalendarIcon size={16} />
                      Add to Google Calendar
                      <ExternalLink size={14} className="text-white/60" />
                    </a>
                  </div>
                </div>

                {joinError && (
                  <p className="text-red-400 text-sm mt-3 font-sans">{joinError}</p>
                )}
              </div>
            </div>
          )}

          {/* Member's Request Reason & Details */}
          <div className="bg-surface rounded-xl p-8 halo-border">
            <h2 className="font-serif text-2xl text-primary mb-6">Member's Reason for Consultation</h2>
            
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-surface-dim flex items-center justify-center font-sans font-medium text-primary shrink-0 uppercase text-sm font-semibold border border-primary/10">
                {getInitials(consultation.memberName)}
              </div>
              <div>
                <h3 className="font-sans text-base font-semibold text-primary">{consultation.memberName}</h3>
                <p className="font-sans text-xs text-primary/60">
                  {consultation.memberEmail || 'Member'}
                </p>
              </div>
            </div>

            <div className="prose prose-sm font-sans text-primary/80 mb-8 border-l-2 border-primary/20 pl-6 py-2 italic whitespace-pre-wrap bg-[#faf8f5] rounded-r-lg">
              "{consultation.reason && consultation.reason.trim() && consultation.reason !== 'No description provided.'
                ? consultation.reason 
                : 'No additional details provided.'}"
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 border-t border-primary/10 pt-6">
              <div>
                <span className="block font-sans text-xs text-primary/50 uppercase tracking-widest mb-1">Urgency</span>
                <span className={`font-sans text-sm font-semibold uppercase ${
                  consultation.urgency === 'high' ? 'text-red-700' : 'text-primary'
                }`}>
                  {consultation.urgency || 'Normal'}
                </span>
              </div>
              <div>
                <span className="block font-sans text-xs text-primary/50 uppercase tracking-widest mb-1">Category</span>
                <span className="font-sans text-sm font-semibold text-primary">{consultation.category}</span>
              </div>
              <div>
                <span className="block font-sans text-xs text-primary/50 uppercase tracking-widest mb-1">Timeline Stage</span>
                <span className="font-sans text-sm font-semibold text-primary capitalize">{consultation.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Controls & Journey) */}
        <aside className="lg:col-span-4 space-y-6">
          
          {/* Session Management Card */}
          <div className="bg-surface rounded-xl p-6 halo-border">
            <h3 className="font-sans text-sm font-semibold text-primary mb-4 border-b border-primary/10 pb-2">
              Pastoral Controls
            </h3>
            
            <div className="space-y-3">
              {!isConfirmed && consultation.status !== 'cancelled' && (
                <button
                  onClick={handleFinalizeMeeting}
                  disabled={isSubmittingFinalize}
                  className="w-full bg-[#1c202e] hover:bg-[#1c202e]/90 text-white py-3.5 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active-sink cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingFinalize ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  )}
                  Confirm Appointment
                </button>
              )}

              {consultation.status !== 'cancelled' && consultation.status !== 'completed' && (
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  disabled={isSubmittingFinalize}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-stone-300 cursor-pointer disabled:opacity-50"
                >
                  <X size={16} /> Cancel Consultation
                </button>
              )}

              {isConfirmed && consultation.status !== 'completed' && consultation.status !== 'cancelled' && (
                <button 
                  onClick={handleMarkCompleted} 
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 active-sink cursor-pointer"
                >
                  <Check size={16} /> Mark as Completed
                </button>
              )}

              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-surface hover:bg-primary/5 text-primary py-3 rounded-lg font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-primary/10 cursor-pointer"
              >
                <CalendarIcon size={16} /> Add to Google Calendar
              </a>
            </div>
          </div>
          
          {/* Journey Timeline */}
          <div className="bg-surface rounded-xl p-6 halo-border">
            <h3 className="font-sans text-xs text-primary/50 uppercase tracking-widest font-semibold mb-6">
              Consultation Journey
            </h3>
            
            <div className="relative border-l border-primary/10 ml-3 space-y-6 pb-2">
              {consultation.journeyTimeline?.map((item, idx) => (
                <div key={idx} className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                  <h4 className="font-sans text-sm font-semibold text-primary">{item.status}</h4>
                  <p className="font-sans text-xs text-primary/70 mt-0.5 leading-relaxed">{item.description}</p>
                  <span className="font-sans text-[10px] text-primary/40 block mt-1">
                    {formatDateTime(item.timestamp, 'short')}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>

      <CancelConsultationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        role="leader"
        consultationCategory={consultation.category}
      />
    </div>
  );
}


