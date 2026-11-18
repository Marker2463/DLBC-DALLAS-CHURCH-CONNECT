import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { db, Consultation } from "../../lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { ChevronLeft, FileText, Calendar, Edit2, CheckCircle2, Loader2, Video, Lock, Clock, Send, ExternalLink, Copy, Check, MapPin, X } from "lucide-react";
import { generateGoogleCalendarUrl } from "../../lib/calendarHelper";
import { isSyntheticMeetUrl } from "../../lib/appointmentService";
import JoinSessionButton from "../../components/JoinSessionButton";
import { formatDateTime, getInitials, formatMeetingMethod, buttonSizes, buttonTokens, tertiaryLinkClass } from "../../lib/canonical";
import { StatusBadge } from "../../components/StatusBadge";
import { CancelConsultationModal } from "../../components/CancelConsultationModal";
import { useToast } from "../../components/ui/ToastProvider";
import { Popover } from "../../components/ui/Popover";

export function MemberRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [consultation, setConsultation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);

  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");

  const [joinState, setJoinState] = useState<'upcoming' | 'ready' | 'ended'>('upcoming');
  const [timeToMeeting, setTimeToMeeting] = useState<string>('');

  useEffect(() => {
    if (!id || !user) {
      if (!user) setLoading(false);
      return;
    }
    const docRef = doc(db, 'consultations', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConsultation({ ...data, id: docSnap.id });
        setReasonDraft(data.reason || "");
      } else {
        setConsultation(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Member consultation subscription error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, user]);

  useEffect(() => {
    if (!id || !user) return;
    const q = query(collection(db, `consultations/${id}/notes`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.warn("Member consultation notes subscription notice:", err?.message || err);
      }
    );
    return () => unsubscribe();
  }, [id, user]);

  useEffect(() => {
    if (!consultation || consultation.status !== 'scheduled' || !consultation.scheduledStart) return;

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(consultation.scheduledStart);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // Assuming 1 hour meetings

      const diff = start.getTime() - now.getTime();
      
      if (now > end) {
        setJoinState('ended');
        setTimeToMeeting('');
      } else if (diff <= 5 * 60 * 1000) { 
        setJoinState('ready');
        setTimeToMeeting('');
      } else {
        setJoinState('upcoming');
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        
        if (days > 0) setTimeToMeeting(`in ${days}d ${hours}h`);
        else if (hours > 0) setTimeToMeeting(`in ${hours}h ${minutes}m`);
        else setTimeToMeeting(`in ${minutes}m`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [consultation]);

  const handleUpdateTime = async () => {
    if (!consultation || !id || !newDate || !newTime) return;
    setIsUpdatingTime(true);
    
    try {
      const selectedTime = new Date(`${newDate}T${newTime}:00`).toISOString();
      
      await fetch('/api/consultations/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: id,
          selectedTime
        })
      });

      await updateDoc(doc(db, 'consultations', id), {
        scheduledStart: selectedTime,
        selectedTime: selectedTime,
        journeyTimeline: [
          ...(consultation.journeyTimeline || []),
          { status: 'Rescheduled', timestamp: new Date().toISOString(), description: `Meeting rescheduled to ${formatDateTime(selectedTime, 'short')} by member.` }
        ]
      });

      setConsultation({...consultation, scheduledStart: selectedTime, selectedTime: selectedTime});
      setIsEditingTime(false);
      showToast({
        variant: 'success',
        title: 'Session Rescheduled',
        message: `Updated to ${formatDateTime(selectedTime, 'short')}.`,
      });
    } catch (err) {
      console.error("Failed to update time", err);
      showToast({
        variant: 'error',
        title: 'Reschedule Failed',
        message: 'Could not update the consultation time. Please try again.',
      });
    } finally {
      setIsUpdatingTime(false);
    }
  };

  const handleSaveReason = async () => {
    if (!consultation || !id) return;
    try {
      await updateDoc(doc(db, 'consultations', id), {
        reason: reasonDraft,
        updatedAt: new Date().toISOString()
      });
      setConsultation({ ...consultation, reason: reasonDraft });
      setIsEditing(false);
      showToast({
        variant: 'success',
        title: 'Changes Saved',
        message: 'Your consultation context has been updated.',
      });
    } catch (err) {
      console.error(err);
      showToast({
        variant: 'error',
        title: 'Save Failed',
        message: 'Unable to save your changes. Please try again.',
      });
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id || !user) return;
    try {
      await addDoc(collection(db, `consultations/${id}/notes`), {
        content: newNote.trim(),
        authorId: user.uid,
        authorName: user.displayName || 'Member',
        authorRole: 'member',
        createdAt: new Date().toISOString()
      });
      setNewNote("");
    } catch (err) {
      console.error(err);
      showToast({
        variant: 'error',
        title: 'Note Failed',
        message: 'Unable to send your note. Please try again.',
      });
    }
  };

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirmCancel = async (reason: string) => {
    if (!consultation || !id) return;
    setIsCancelling(true);
    try {
      const res = await fetch('/api/consultations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: id,
          cancelledBy: 'member',
          cancellationReason: reason,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to cancel consultation.");
      }
    } catch (err: unknown) {
      console.error("Failed to cancel consultation:", err);
      throw err;
    } finally {
      setIsCancelling(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!consultation || !id || !user) return;
    setIsSubmitting(true);
    
    try {
      let googleMeetUrl = consultation.meetUrl || consultation.googleMeetUrl || consultation.meetingLink || null;
      if (googleMeetUrl && isSyntheticMeetUrl(googleMeetUrl, id)) {
        googleMeetUrl = null;
      }
      let googleEventId = consultation.calendarEventId || consultation.googleEventId || null;

      if (!googleMeetUrl && (consultation.meetingMethod === 'google_meet' || consultation.meetingMethod === 'in_person')) {
        const response = await fetch('/api/calendar/schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            consultationId: id,
            title: `Pastoral Consultation — ${consultation.category || 'Pastoral Care'}`,
            memberEmail: user.email,
            leaderEmail: consultation.leaderEmail,
            selectedTime: consultation.selectedTime || consultation.scheduledStart,
            method: consultation.meetingMethod,
            isMember: true,
          })
        });

        if (response.ok) {
          const resText = await response.text();
          let data: any = null;
          try { data = JSON.parse(resText); } catch {}
          if (data?.googleMeetUrl || data?.meetUrl) googleMeetUrl = data.meetUrl || data.googleMeetUrl;
          if (data?.eventId || data?.calendarEventId) googleEventId = data.calendarEventId || data.eventId;
        }
      }

      const timeline = [...(consultation.journeyTimeline || [])];
      timeline.push({
        status: 'Meeting Scheduled',
        timestamp: new Date().toISOString(),
        description: 'Your meeting is scheduled. Calendar invites and reminders have been sent.'
      });

      await updateDoc(doc(db, 'consultations', id), {
        status: 'scheduled',
        isLocked: true,
        googleMeetUrl,
        meetUrl: googleMeetUrl,
        googleEventId,
        calendarEventId: googleEventId,
        meetingLink: googleMeetUrl,
        journeyTimeline: timeline
      });

      navigate('/member/sanctuary');
    } catch (err) {
      console.error(err);
      showToast({
        variant: 'error',
        title: 'Finalization Failed',
        message: 'Unable to finalize your consultation request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary/50" size={32} />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <FileText className="text-primary/20 mb-4" size={64} />
        <h1 className="text-xl font-serif text-primary mb-2">Record Not Found</h1>
        <p className="text-primary-muted font-sans max-w-md">The consultation request you are looking for may have been archived or does not exist.</p>
        <button onClick={() => navigate('/member/sanctuary')} className="mt-6 text-primary hover:text-primary-muted font-medium flex items-center gap-2">
          <ChevronLeft size={16} /> Return to Sanctuary
        </button>
      </div>
    );
  }

  const isLocked = consultation.isLocked || consultation.status !== 'draft';
  const meetingLink = consultation.meetUrl || consultation.googleMeetUrl || consultation.meetingLink || (consultation as any)?.meeting?.url || null;

  const renderTimelineNode = (title: string, currentStatus: string, desc: string, isPast: boolean, isActive: boolean) => (
    <div className="relative pl-6">
      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${isActive ? 'bg-primary shadow-[0_0_8px_rgba(28,32,46,0.3)]' : isPast ? 'bg-primary' : 'bg-primary/20'}`} />
      <h3 className={`font-sans text-sm font-semibold ${isActive ? 'text-primary' : isPast ? 'text-primary' : 'text-primary-muted'}`}>{title}</h3>
      <p className="font-sans text-xs text-primary-muted mt-1">{desc}</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-x-clip bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-primary/10 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex-shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button 
            onClick={() => navigate('/member/sanctuary')}
            aria-label="Return to Sanctuary"
            className="p-2 -ml-2 rounded-full hover:bg-primary/5 text-primary-muted hover:text-primary transition-colors cursor-pointer shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="font-serif text-xl sm:text-2xl text-primary font-medium">Request Details</h1>
              <StatusBadge status={consultation.status} />
              {isLocked && <Lock size={14} className="text-primary-muted" />}
            </div>
            <p className="font-sans text-sm text-primary-muted truncate">
              {consultation.category}
            </p>
          </div>
        </div>
        
        {!isLocked && (
          <button 
            onClick={handleFinalSubmit}
            disabled={isSubmitting}
            className="w-full md:w-auto min-h-[44px] bg-[#1c202e] hover:bg-[#1c202e]/90 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all active-sink shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Finalize &amp; Submit
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 sm:gap-8 max-w-7xl mx-auto w-full">
        {/* Left Column - Main Content */}
        <div className="lg:w-[60%] flex flex-col gap-6 sm:gap-8 min-w-0">
          
          {/* Status Banner (Omitted when Under Review; reflows upward cleanly) */}
          {consultation.status !== 'under_review' && (
            <div className="bg-surface rounded-xl p-5 sm:p-6 halo-border flex items-start gap-3.5 sm:gap-4">
              <div className="bg-primary/5 p-2.5 sm:p-3 rounded-full text-primary mt-0.5 shrink-0">
                {consultation.status === 'draft' ? <Edit2 size={20} /> : 
                 consultation.status === 'scheduled' ? <Calendar size={20} /> : 
                 <FileText size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-sans text-sm sm:text-base font-semibold text-primary">Status:</span>
                  <StatusBadge status={consultation.status} />
                </div>
                <p className="font-sans text-xs sm:text-sm text-primary-muted leading-relaxed">
                  {consultation.status === 'draft' && "Your request is saved as a draft. Edit details below and finalize when ready."}
                  {consultation.status === 'scheduled' && "A pastoral consultation has been provisioned. See session details below."}
                  {consultation.status === 'completed' && "This consultation session has concluded."}
                  {consultation.status === 'cancelled' && "This consultation has been cancelled."}
                </p>
                {consultation.status === 'cancelled' && consultation.cancellationReason && (
                  <div className="mt-2.5">
                    <Popover title="Cancellation Reason" triggerLabel="View Reason">
                      <p>{consultation.cancellationReason}</p>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Access (If Scheduled) */}
          {consultation.status === 'scheduled' && (
            <div className="bg-[#1c202e] rounded-xl p-5 sm:p-8 text-white relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <span className="font-sans text-xs text-white/80 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" /> Confirmed Pastoral Session
                  </span>
                </div>

                <h2 className="font-serif text-2xl font-medium mb-1">
                  Session with {consultation.leaderName || 'Pastoral Team'}
                </h2>
                <p className="font-sans text-sm text-white/90 mb-6">
                  Scheduled for {consultation.scheduledStart || consultation.selectedTime ? formatDateTime(consultation.scheduledStart || consultation.selectedTime, 'long') : 'Pending Confirmation'}
                </p>

                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-4 border-t border-white/10">
                  {consultation.meetingMethod === 'in_person' ? (
                    <div className="bg-white/10 px-5 py-3 rounded-lg text-left">
                      <span className="block font-sans text-xs text-white/80 uppercase tracking-wider mb-0.5">Location</span>
                      <span className="font-sans text-sm font-semibold">{consultation.meetingLocation || 'DLBC Church Sanctuary / Office'}</span>
                    </div>
                  ) : (
                    <JoinSessionButton
                      consultationId={consultation.id}
                      initialMeetingLink={meetingLink}
                      buttonText="Enter Session Room"
                      loadingText="Connecting..."
                      icon={<Video size={16} />}
                      className="min-h-[44px] w-full sm:w-auto bg-white text-[#1c202e] hover:bg-white/90 px-6 py-3 rounded-lg font-sans text-sm font-bold transition-colors flex items-center justify-center gap-2 active-sink whitespace-nowrap cursor-pointer disabled:opacity-50"
                    />
                  )}

                  {/* 1-Click Google Calendar Sync */}
                  <a
                    href={generateGoogleCalendarUrl(consultation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-lg font-sans text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-white/15 cursor-pointer whitespace-nowrap"
                  >
                    <Calendar size={16} />
                    Add to Google Calendar
                    <ExternalLink size={14} className="text-white/60" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          {consultation.status !== 'completed' && consultation.status !== 'cancelled' && (
            <div className="bg-surface rounded-xl p-5 sm:p-6 halo-border">
              <h2 className="font-sans text-sm font-semibold text-primary mb-4 border-b border-primary/10 pb-2">Session Actions</h2>
              <div className="space-y-3">
                <div className="w-full space-y-3">
                  {consultation.meetingMethod !== 'in_person' && (
                    <JoinSessionButton
                      consultationId={consultation.id}
                      initialMeetingLink={meetingLink}
                      buttonText="Enter Session Room"
                      loadingText="Connecting..."
                      icon={<Video size={16} />}
                      className="w-full bg-[#1c202e] text-white hover:bg-[#1c202e]/90 py-3 rounded-md font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 active-sink cursor-pointer disabled:opacity-50"
                    />
                  )}

                  <a
                    href={generateGoogleCalendarUrl(consultation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-surface hover:bg-primary/5 text-primary py-3 rounded-md font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 active-sink halo-border"
                  >
                    <Calendar size={16} /> Add to Google Calendar
                  </a>
                  
                  <button onClick={() => setIsEditingTime(!isEditingTime)} className="w-full bg-surface hover:bg-primary/5 text-primary py-3 rounded-md font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 active-sink halo-border">
                    <Clock size={16} /> Reschedule Time
                  </button>

                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    disabled={isCancelling}
                    className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 rounded-md font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-stone-300 cursor-pointer disabled:opacity-50"
                  >
                    <X size={16} /> Cancel Consultation
                  </button>
                  
                  {isEditingTime && (
                    <div className="mt-4 p-4 border border-primary/10 rounded-lg bg-surface space-y-4">
                      <div>
                        <label htmlFor="reschedule-date" className="block text-xs font-semibold text-primary mb-1 uppercase tracking-wider">New Date</label>
                        <input id="reschedule-date" aria-label="New Date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-white border border-primary/20 rounded p-2 text-sm text-primary focus:outline-none focus:border-secondary" />
                      </div>
                      <div>
                        <label htmlFor="reschedule-time" className="block text-xs font-semibold text-primary mb-1 uppercase tracking-wider">New Time</label>
                        <input id="reschedule-time" aria-label="New Time" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full bg-white border border-primary/20 rounded p-2 text-sm text-primary focus:outline-none focus:border-secondary" />
                      </div>
                      <button onClick={handleUpdateTime} disabled={isUpdatingTime} className="w-full bg-[#1c202e] hover:bg-[#1c202e]/90 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-sm">
                        {isUpdatingTime ? 'Updating...' : 'Confirm Reschedule'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Request Journey Timeline */}
          <div>
            <h2 className="font-sans text-xs text-primary-muted uppercase tracking-widest font-semibold mb-8">
              Request Journey
            </h2>
            
            <div className="relative border-l border-primary/10 ml-4 space-y-10 pb-4">
              {renderTimelineNode(
                'Request Drafted',
                consultation.status,
                'You have drafted the request details.',
                true,
                false
              )}
              {renderTimelineNode(
                'Final Submit & Review',
                consultation.status,
                'Lock and submit your request for pastoral assignment.',
                ['scheduled', 'completed', 'submitted'].includes(consultation.status),
                consultation.status === 'under_review' || consultation.status === 'submitted'
              )}
              {renderTimelineNode(
                'Meeting Scheduled',
                consultation.status,
                'A secure digital session has been provisioned.',
                consultation.status === 'completed' || consultation.status === 'scheduled',
                consultation.status === 'scheduled'
              )}
              {renderTimelineNode(
                'Completed',
                consultation.status,
                'Post-session reflections.',
                consultation.status === 'completed',
                consultation.status === 'completed'
              )}
            </div>
          </div>

        </div>

        {/* Right Sidebar Summary Column */}
        <div className="lg:w-[40%] flex flex-col gap-6 min-w-0">
          <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-sans text-xs text-primary-muted uppercase tracking-widest font-semibold">
                Original Summary
              </h2>
              {!isLocked && (
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-primary hover:text-primary-muted text-xs font-sans uppercase tracking-widest font-medium transition-colors cursor-pointer"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            
            <div className="mb-8">
              <span className="font-sans text-sm text-primary-muted block mb-2">Request Context</span>
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <label htmlFor="reason-draft-textarea" className="sr-only">Edit request context</label>
                  <textarea 
                    id="reason-draft-textarea"
                    aria-label="Edit request context"
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    className="w-full bg-background border border-primary/20 rounded-md p-4 font-sans text-sm text-primary focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all resize-y min-h-[120px]"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleSaveReason}
                      className="px-4 py-2 bg-[#1c202e] text-white rounded text-sm font-medium hover:bg-[#2c2e35] transition-colors cursor-pointer shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <p className="font-sans text-base text-primary leading-relaxed whitespace-pre-wrap break-words">
                  {consultation.reason && consultation.reason.trim() && consultation.reason !== "No description provided."
                    ? consultation.reason 
                    : "No additional details provided."}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="font-sans text-sm text-primary-muted block mb-1">Urgency</span>
                <span className="font-sans text-base text-primary capitalize">{consultation.urgency}</span>
              </div>
              <div>
                <span className="font-sans text-sm text-primary-muted block mb-1">Requested Time</span>
                <span className="font-sans text-base text-primary">
                  {consultation.selectedTime ? formatDateTime(consultation.selectedTime, 'short') : 'TBD'}
                </span>
              </div>
            </div>
          </div>

          {/* Pastoral Notes & Comments */}
          <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border flex flex-col">
            <h2 className="font-sans text-xs text-primary-muted uppercase tracking-widest font-semibold mb-6">
              Notes &amp; Updates
            </h2>
            
            <div className="flex-1 overflow-y-auto max-h-[300px] mb-4 space-y-4 pr-1">
              {notes.length === 0 ? (
                <p className="text-sm font-sans text-primary-muted italic">No notes yet.</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className={`p-3.5 sm:p-4 rounded-lg ${note.authorId === user?.uid ? 'bg-background border border-primary/10 ml-2 sm:ml-4' : 'bg-primary/5 mr-2 sm:mr-4'}`}>
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="font-sans text-xs font-bold text-primary">{note.authorRole === 'member' ? 'You' : 'Pastor/Leader'}</span>
                      <span className="font-sans text-xs text-primary-muted whitespace-nowrap">{formatDateTime(note.createdAt, 'time')}</span>
                    </div>
                    <p className="font-sans text-sm text-primary break-words">{note.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddNote} className="relative mt-auto">
              <label htmlFor="member-note-input" className="sr-only">Add a secure note</label>
              <input 
                id="member-note-input"
                type="text" 
                aria-label="Add a secure note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a secure note..."
                className="w-full bg-background border border-primary/20 rounded-md py-3 pl-4 pr-12 font-sans text-sm text-primary placeholder:text-primary-muted focus:outline-none focus:border-primary/60"
              />
              <button type="submit" aria-label="Send note" disabled={!newNote.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary-muted hover:text-primary disabled:opacity-50 cursor-pointer">
                <Send size={16} />
              </button>
            </form>
          </div>

        </div>
      </div>

      <CancelConsultationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        role="member"
        consultationCategory={consultation.category}
      />
    </div>
  );
}
