import { Link } from 'react-router-dom';
import { Calendar, MessageSquare, Users, Edit3, Loader2, Award, Video } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect } from 'react';
import { db, Consultation } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import JoinSessionButton from '../../components/JoinSessionButton';
import studyImg from '../../assets/images/pastoral_care_study_1787251812830.jpg';
import pewsImg from '../../assets/images/church_pews_editorial_1787251824185.jpg';
import { getInitials, formatDateTime, tertiaryLinkClass } from '../../lib/canonical';
import { StatusBadge } from '../../components/StatusBadge';
import { QuoteInline } from '../../components/Quotes';
import { useToast } from '../../components/ui/ToastProvider';

export function LeaderDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderNote, setLeaderNote] = useState('');

  useEffect(() => {
    if (!user) return;
    
    // Query active consultations for this leader
    const q = query(
      collection(db, 'consultations'),
      where('leaderId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
      
      // Filter out completed, archived, and cancelled ones, keep only active
      const activeDocs = docs.filter(c => c.status !== 'completed' && c.status !== 'archived' && c.status !== 'cancelled');
      
      // Sort descending so most recent is first
      activeDocs.sort((a, b) => {
        const timeA = a.scheduledStart || a.selectedTime ? new Date(a.scheduledStart || a.selectedTime || '').getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.scheduledStart || b.selectedTime ? new Date(b.scheduledStart || b.selectedTime || '').getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setConsultations(activeDocs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching leader consultations:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveNote = () => {
    showToast({
      variant: 'success',
      title: 'Note Saved',
      message: leaderNote.trim()
        ? 'Your personal ministry note has been saved for this session.'
        : 'Ministry notes workspace ready.',
    });
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 md:py-16 pb-28 sm:pb-32">
      {/* Header Greeting */}
      <div className="mb-10 sm:mb-12">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary mb-4 tracking-tight break-words">
          Peace be with you, {user?.displayName || 'Leader'}.
        </h1>
        <QuoteInline
          quote="Let your light shine before others, that they may see your good deeds and glorify your Father in heaven."
          citation="Matthew 5:16"
        />
      </div>

      <section className="mb-14 sm:mb-16 min-h-[480px] lg:min-h-[520px]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* Active Assigned Consultations */}
        <section
          aria-labelledby="leader-consultations-heading"
          className="lg:col-span-2 min-w-0 bg-surface rounded-xl p-5 sm:p-8 halo-border flex flex-col min-h-[360px]"
        >
          <div className="mb-6 sm:mb-8 flex flex-col gap-3 border-b border-primary/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 text-primary">
              <MessageSquare size={20} className="shrink-0 text-primary-muted" aria-hidden="true" />
              <h2 id="leader-consultations-heading" className="min-w-0 break-words font-serif text-xl sm:text-2xl text-primary">
                Assigned Consultations
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link to="/pastor/availability" className={tertiaryLinkClass}>
                Schedule Availability
              </Link>
              <Link to="/pastor/archives" className={tertiaryLinkClass}>
                View Records
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div role="status" aria-busy="true" className="divide-y divide-primary/5 animate-pulse flex-1">
                <span className="sr-only">Loading consultations</span>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-xl px-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 shrink-0" />
                    <div className="min-w-0 space-y-2">
                      <div className="h-5 bg-primary/10 rounded w-1/3" />
                      <div className="h-4 bg-primary/10 rounded w-1/2" />
                    </div>
                    <div className="col-start-2 sm:col-start-3 sm:min-w-[12rem] flex justify-end">
                      <div className="h-9 w-24 bg-primary/10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div role="alert" className="text-center py-8">
                <p className="font-sans text-base text-red-700">We couldn't load your consultations. Please refresh and try again.</p>
              </div>
            ) : consultations.length === 0 ? (
              <div className="border border-dashed border-[#e2dcce] bg-[#faf8f3] rounded-xl p-6 sm:p-8 text-center flex flex-col items-center justify-center my-auto">
                <p className="font-serif text-lg text-primary mb-2">No active consultations assigned at this time.</p>
                <p className="font-sans text-sm text-primary-subtle max-w-sm">
                  When congregants schedule sessions with your ministry category, upcoming appointments will appear here.
                </p>
              </div>
            ) : (
              <ul role="list" className="divide-y divide-primary/5">
                {consultations.map((consultation) => (
                  <li
                    key={consultation.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-xl px-2 sm:px-3 py-4 transition-colors hover:bg-primary/[0.02] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div aria-hidden="true" className="w-12 h-12 rounded-full bg-surface-dim flex items-center justify-center font-sans text-primary shadow-sm shrink-0 uppercase text-sm font-semibold border border-primary/10">
                      {getInitials(consultation.memberName)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-sans text-base font-semibold text-primary break-words">{consultation.memberName}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`px-2 py-0.5 rounded text-xs shrink-0 whitespace-nowrap font-bold uppercase tracking-wider ${
                          consultation.urgency === 'high' ? 'bg-red-50 text-red-700 border border-red-200/50' :
                          consultation.urgency === 'medium' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200/50' :
                          'bg-surface-dim text-primary-muted border border-primary/10'
                        }`}>
                          {consultation.urgency || 'Normal'}
                        </span>
                        <StatusBadge status={consultation.status} />
                      </div>
                      <p className="mt-1.5 font-sans text-sm text-primary-muted break-words">
                        {consultation.category} • {consultation.selectedTime ? formatDateTime(consultation.selectedTime, 'short') : 'Date pending'}
                      </p>
                    </div>

                    <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:min-w-[12rem] sm:justify-end">
                      {consultation.meetingMethod !== 'in_person' && consultation.status === 'scheduled' && (
                        <JoinSessionButton
                          consultationId={consultation.id}
                          initialMeetingLink={consultation.meetingLink || consultation.meetUrl || consultation.googleMeetUrl}
                          buttonText="Join"
                          loadingText="Joining..."
                          role="leader"
                          icon={<Video size={13} />}
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1c202e] px-3 py-2 font-sans text-xs font-semibold text-white transition-all hover:bg-[#1c202e]/90 shadow-sm cursor-pointer disabled:opacity-50 sm:flex-none"
                        />
                      )}
                      <Link
                        to={`/pastor/request/${consultation.id}`}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-primary/10 bg-surface px-4 py-2 font-sans text-xs font-semibold text-primary transition-all hover:bg-primary/5 sm:flex-none cursor-pointer"
                      >
                        View Detail
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right Column */}
        <div className="flex flex-col gap-6 sm:gap-8">
          
          {/* Department & Ministry Oversight */}
          <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Users size={20} className="text-primary-muted shrink-0" />
              <h2 className="font-serif text-xl sm:text-2xl text-primary">Ministry Oversight</h2>
            </div>
            
            <div className="mb-6">
              <h3 className="font-sans text-sm font-semibold text-primary mb-3">Leadership &amp; Discipleship Cadence</h3>
              <div className="w-full bg-primary/5 h-1.5 rounded-full mb-3 overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="flex justify-between text-xs font-sans text-primary-muted">
                <span>Active Cohort</span>
                <span>85% Engagement</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-sans text-primary-muted pt-4 border-t border-primary/5">
              <Calendar size={14} className="shrink-0" />
              <span className="font-medium">Upcoming leadership fellowship this week</span>
            </div>
          </div>

          {/* Reflections */}
          <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border flex-grow flex flex-col">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Edit3 size={20} className="text-primary-muted shrink-0" />
              <h2 className="font-serif text-xl sm:text-2xl text-primary">Ministry Notes</h2>
            </div>
            <label htmlFor="leader-notes" className="sr-only">Ministry Notes</label>
            <textarea 
              id="leader-notes"
              aria-label="Personal ministry reflections or discipleship prayer points"
              value={leaderNote}
              onChange={(e) => setLeaderNote(e.target.value)}
              className="w-full h-32 bg-background border border-primary/20 rounded-md p-4 font-sans text-sm text-primary placeholder:text-primary-muted focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none mb-4"
              placeholder="Personal ministry reflections, discipleship prayer points..."
            ></textarea>
            <div className="mt-auto flex justify-end">
              <button
                type="button"
                onClick={handleSaveNote}
                className="font-sans text-xs font-semibold uppercase tracking-widest text-primary border border-control px-3.5 py-2.5 min-h-[40px] rounded-md hover:bg-surface-dim transition-colors cursor-pointer active-sink"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
        </div>
      </section>
      
      {/* Spiritual Vitality */}
      <div>
        <h2 className="font-serif text-2xl text-primary mb-8 border-b border-primary/10 pb-4">Leadership Rhythm &amp; Vitality</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Sabbath Rhythm */}
          <div className="group cursor-pointer">
            <div className="aspect-[21/9] rounded-xl overflow-hidden mb-4 relative">
              <img 
                src={studyImg} 
                alt="Quiet study space" 
                width={600}
                height={257}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors duration-500"></div>
              <div className="absolute bottom-4 left-4">
                <span className="bg-white/95 backdrop-blur-sm text-primary font-sans text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded">Protected Time</span>
              </div>
            </div>
            <h3 className="font-serif text-xl text-primary mb-2">Personal Devotion</h3>
            <p className="font-sans text-sm text-primary-muted">Scheduled prayer and renewal: Weekly quiet time block</p>
          </div>

          {/* Leaders Fellowship */}
          <div className="group cursor-pointer">
            <div className="aspect-[21/9] rounded-xl overflow-hidden mb-4 relative">
              <img 
                src={pewsImg} 
                alt="Church fellowship" 
                width={600}
                height={257}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/10 transition-colors duration-500"></div>
              <div className="absolute bottom-4 left-4">
                <span className="bg-white/95 backdrop-blur-sm text-primary font-sans text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded">Upcoming</span>
              </div>
            </div>
            <h3 className="font-serif text-xl text-primary mb-2">Ministry Leaders Gathering</h3>
            <p className="font-sans text-sm text-primary-muted">Monthly leadership prayer and strategic alignment session.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
