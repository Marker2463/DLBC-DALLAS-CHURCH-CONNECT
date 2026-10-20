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

export function LeaderDashboard() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="max-w-7xl mx-auto px-6 w-full py-16 pb-32">
      {/* Header Greeting */}
      <div className="mb-12">
        <h1 className="font-serif text-5xl md:text-6xl text-primary mb-4 tracking-tight">
          Peace be with you, {user?.displayName || 'Leader'}.
        </h1>
        <QuoteInline
          quote="Let your light shine before others, that they may see your good deeds and glorify your Father in heaven."
          citation="Matthew 5:16"
        />
      </div>

      <section className="mb-16 min-h-[580px] sm:min-h-[620px] lg:min-h-[520px]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* Active Assigned Consultations */}
        <div className="lg:col-span-2 bg-surface rounded-xl p-8 halo-border flex flex-col min-h-[360px]">
          <div className="flex justify-between items-center mb-8 border-b border-primary/10 pb-4">
            <div className="flex items-center gap-3 text-primary">
              <MessageSquare size={20} className="text-primary-muted" />
              <h2 className="font-serif text-2xl text-primary">Assigned Consultations</h2>
            </div>
            <div className="flex items-center gap-4">
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
              <div role="status" aria-busy="true" className="space-y-4 animate-pulse flex-1">
                <span className="sr-only">Loading consultations</span>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-primary/5 p-3 rounded-xl">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 shrink-0" />
                      <div className="space-y-2">
                        <div className="h-5 bg-primary/10 rounded w-36" />
                        <div className="h-4 bg-primary/10 rounded w-48" />
                      </div>
                    </div>
                    <div className="h-9 w-24 bg-primary/10 rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="font-sans text-base text-red-500">Error loading consultations: {error}</p>
              </div>
            ) : consultations.length === 0 ? (
              <div className="border border-dashed border-[#e2dcce] bg-[#faf8f3] rounded-xl p-8 text-center flex flex-col items-center justify-center my-auto">
                <p className="font-serif text-lg text-primary mb-2">No active consultations assigned at this time.</p>
                <p className="font-sans text-sm text-primary-subtle max-w-sm">
                  When congregants schedule sessions with your ministry category, upcoming appointments will appear here.
                </p>
              </div>
            ) : (
              consultations.map((consultation) => (
                <div 
                  key={consultation.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-primary/5 hover:bg-primary/[0.02] p-3 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface-dim flex items-center justify-center font-sans font-medium text-primary shadow-sm shrink-0 uppercase text-sm font-semibold border border-primary/10">
                      {getInitials(consultation.memberName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-sans text-base font-semibold text-primary">{consultation.memberName}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                          consultation.urgency === 'high' ? 'bg-red-50 text-red-700 border border-red-200/50' :
                          consultation.urgency === 'medium' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200/50' :
                          'bg-surface-dim text-primary-muted border border-primary/10'
                        }`}>
                          {consultation.urgency || 'Normal'}
                        </span>

                        <StatusBadge status={consultation.status} />
                      </div>
                      <p className="font-sans text-sm text-primary-muted">
                        {consultation.category} • {consultation.selectedTime ? formatDateTime(consultation.selectedTime, 'short') : 'Date pending'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {consultation.meetingMethod !== 'in_person' && consultation.status === 'scheduled' && (
                      <JoinSessionButton
                        consultationId={consultation.id}
                        initialMeetingLink={consultation.meetingLink || consultation.meetUrl || consultation.googleMeetUrl}
                        buttonText="Join"
                        loadingText="Joining..."
                        icon={<Video size={13} />}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-sans text-xs font-semibold bg-[#1c202e] text-white hover:bg-[#1c202e]/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      />
                    )}
                    <Link
                      to={`/pastor/request/${consultation.id}`}
                      className="px-4 py-2 rounded-lg font-sans text-xs font-semibold transition-all bg-surface hover:bg-primary/5 text-primary border border-primary/10 cursor-pointer"
                    >
                      View Detail
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-8">
          
          {/* Department & Ministry Oversight */}
          <div className="bg-surface rounded-xl p-8 halo-border">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Users size={20} className="text-primary-muted" />
              <h2 className="font-serif text-2xl text-primary">Ministry Oversight</h2>
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
              <Calendar size={14} />
              <span className="font-medium">Upcoming leadership fellowship this week</span>
            </div>
          </div>

          {/* Reflections */}
          <div className="bg-surface rounded-xl p-8 halo-border flex-grow flex flex-col">
            <div className="flex items-center gap-3 mb-6 text-primary">
              <Edit3 size={20} className="text-primary-muted" />
              <h2 className="font-serif text-2xl text-primary">Ministry Notes</h2>
            </div>
            <label htmlFor="leader-notes" className="sr-only">Ministry Notes</label>
            <textarea 
              id="leader-notes"
              aria-label="Personal ministry reflections or discipleship prayer points"
              className="w-full h-32 bg-background border border-primary/20 rounded-md p-4 font-sans text-sm text-primary placeholder:text-primary-muted focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none mb-4"
              placeholder="Personal ministry reflections, discipleship prayer points..."
            ></textarea>
            <div className="mt-auto flex justify-end">
              <button className="font-sans text-xs font-semibold uppercase tracking-widest text-primary border border-control px-3.5 py-2 rounded-md hover:bg-surface-dim transition-colors cursor-pointer active-sink">
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
