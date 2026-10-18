import { Link } from 'react-router-dom';
import { Calendar, MessageSquare, Users, Edit3, Loader2, Video } from 'lucide-react';
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

export function PastorDashboard() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Query active consultations for this pastor
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
      console.error("Error fetching consultations:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 md:py-16 pb-32">
      <div className="mb-12">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary mb-4 tracking-tight break-words">
          Peace be with you, {user?.displayName || 'Pastor'}.
        </h1>
        <QuoteInline quote="Feed my sheep." citation="John 21:17" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-16 items-start">
        
        {/* Active Consultations */}
        <section
          aria-labelledby="active-consultations-heading"
          className="lg:col-span-2 min-w-0 bg-surface rounded-xl p-5 sm:p-8 halo-border flex flex-col"
        >
          <div className="mb-6 sm:mb-8 flex flex-col gap-3 border-b border-primary/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 text-primary/80">
              <MessageSquare size={20} className="shrink-0" aria-hidden="true" />
              <h2 id="active-consultations-heading" className="min-w-0 break-words font-serif text-xl sm:text-2xl text-primary">
                Active Consultations
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link to="/pastor/availability" className={tertiaryLinkClass}>Schedule Availability</Link>
              <Link to="/pastor/archives" className={tertiaryLinkClass}>View Records</Link>
            </div>
          </div>

          {loading ? (
            <div role="status" className="flex h-32 items-center justify-center">
              <Loader2 className="animate-spin text-primary/30" size={32} aria-hidden="true" />
              <span className="sr-only">Loading consultations</span>
            </div>
          ) : error ? (
            <div role="alert" className="py-8 text-center">
              <p className="font-sans text-base text-red-700">We couldn't load your consultations. Please refresh and try again.</p>
            </div>
          ) : consultations.length === 0 ? (
            <div className="border border-dashed border-[#e2dcce] bg-[#faf8f3] rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <p className="font-serif text-lg text-primary mb-2">No active consultations currently scheduled.</p>
              <p className="font-sans text-sm text-primary/60 max-w-sm">When congregants request guidance, upcoming sessions will appear here.</p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-primary/5">
              {consultations.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-xl px-3 py-4 transition-colors hover:bg-primary/[0.02] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  {/* Column 1: avatar (fixed width) */}
                  <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-surface-dim text-sm font-semibold uppercase text-primary shadow-sm">
                    {getInitials(c.memberName)}
                  </div>

                  {/* Column 2: content (flexible, wraps) */}
                  <div className="min-w-0">
                    <h3 className="break-words font-sans text-base font-semibold text-primary">{c.memberName}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`px-2 py-0.5 rounded text-xs shrink-0 whitespace-nowrap font-bold uppercase tracking-wider ${
                        c.urgency === 'high' ? 'bg-red-50 text-red-700 border border-red-200/50' :
                        c.urgency === 'medium' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200/50' :
                        'bg-surface-dim text-primary/70 border border-primary/10'
                      }`}>
                        {c.urgency || 'Normal'}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-1.5 break-words font-sans text-sm text-primary/70">{c.category}</p>
                    <p className="font-sans text-sm text-primary/70">
                      {c.selectedTime ? formatDateTime(c.selectedTime, 'short') : 'Date pending'}
                    </p>
                  </div>

                  {/* Column 3: actions (right-aligned; sits under the content on mobile) */}
                  <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:min-w-[12rem] sm:justify-end">
                    {c.meetingMethod !== 'in_person' && c.status === 'scheduled' && (
                      <JoinSessionButton
                        consultationId={c.id}
                        initialMeetingLink={c.meetingLink}
                        buttonText="Join"
                        loadingText="Joining..."
                        icon={<Video size={13} />}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1c202e] px-3 py-2 font-sans text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#1c202e]/90 disabled:opacity-50 sm:flex-none cursor-pointer"
                      />
                    )}
                    <Link
                      to={`/pastor/request/${c.id}`}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-primary/10 bg-surface px-4 py-2 font-sans text-xs font-semibold text-primary transition-all hover:bg-primary/5 sm:flex-none cursor-pointer"
                    >
                      View Detail
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right Column */}
        <div className="flex flex-col gap-8">
          
          {/* Ministry Oversight */}
          <div className="bg-surface rounded-xl p-8 halo-border">
            <div className="flex items-center gap-3 mb-6 text-primary/50">
              <Users size={20} />
              <h2 className="font-serif text-2xl text-primary">Ministry Oversight</h2>
            </div>
            
            <div className="mb-6">
              <h4 className="font-sans text-sm font-semibold text-primary mb-3">Youth Leadership Program</h4>
              <div className="w-full bg-primary/5 h-1.5 rounded-full mb-3 overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="flex justify-between text-xs font-sans text-primary/70">
                <span>12 Members Active</span>
                <span>85% Complete</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-sans text-primary/80 pt-4 border-t border-primary/5">
              <Calendar size={14} />
              <span className="font-medium">2 upcoming milestones this week</span>
            </div>
          </div>

          {/* Reflections */}
          <div className="bg-surface rounded-xl p-8 halo-border flex-grow flex flex-col">
            <div className="flex items-center gap-3 mb-6 text-primary/50">
              <Edit3 size={20} />
              <h2 className="font-serif text-2xl text-primary">Reflections</h2>
            </div>
            <textarea 
              className="w-full h-32 bg-background border border-primary/10 rounded-md p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none mb-4"
              placeholder="Personal pastoral reflections or prayer points..."
            ></textarea>
            <div className="mt-auto flex justify-end">
              <button className={tertiaryLinkClass}>
                Save Note
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Spiritual Vitality */}
      <div>
        <h2 className="font-serif text-2xl text-primary mb-8 border-b border-primary/10 pb-4">Spiritual Vitality</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Sabbath Rhythm */}
          <div className="group cursor-pointer">
            <div className="aspect-[21/9] rounded-xl overflow-hidden mb-4 relative">
              <img 
                src={studyImg} 
                alt="Quiet study space" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors duration-500"></div>
              <div className="absolute bottom-4 left-4">
                <span className="bg-white/90 backdrop-blur-sm text-primary font-sans text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">Protected Time</span>
              </div>
            </div>
            <h3 className="font-serif text-xl text-primary mb-2">Sabbath Rhythm</h3>
            <p className="font-sans text-sm text-primary/70">Next scheduled rest: Friday, 8:00 AM - Saturday, 8:00 AM</p>
          </div>

          {/* Elders Retreat */}
          <div className="group cursor-pointer">
            <div className="aspect-[21/9] rounded-xl overflow-hidden mb-4 relative">
              <img 
                src={pewsImg} 
                alt="Empty church pews" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/10 transition-colors duration-500"></div>
              <div className="absolute bottom-4 left-4">
                <span className="bg-white/90 backdrop-blur-sm text-primary font-sans text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">Upcoming</span>
              </div>
            </div>
            <h3 className="font-serif text-xl text-primary mb-2">Elders Retreat 2026</h3>
            <p className="font-sans text-sm text-primary/70">Reviewing agenda and spiritual objectives. Due in 14 days.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
