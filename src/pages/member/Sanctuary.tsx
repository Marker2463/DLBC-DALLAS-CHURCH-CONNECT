import { useState, useEffect } from 'react';
import { 
  Lock, 
  Video, 
  ArrowRight, 
  Loader2, 
  HeartHandshake,
  Heart,
  ShieldCheck,
  ScrollText,
  MapPin,
  BookOpen
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { db, Consultation } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import JoinSessionButton from '../../components/JoinSessionButton';
import { formatDateTime, getInitials, tertiaryLinkClass } from '../../lib/canonical';
import { StatusBadge } from '../../components/StatusBadge';
import { PageTitle } from '../../components/PageTitle';
import { UpcomingConsultationBanner } from '../../components/UpcomingConsultationBanner';
import { FormatChip } from '../../components/FormatChip';
import { RosterFilterChips, FilterKey, matchesRosterFilter } from '../../components/RosterFilterChips';

const FILTER_EMPTY_NAMES: Record<FilterKey, string> = {
  all: 'all cases',
  scheduled: 'scheduled',
  review: 'pending review',
  completed: 'completed',
  cancelled: 'cancelled',
};

export function MemberSanctuary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'consultations'),
      where('memberId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
        // Sort descending so the most recent appointment is at the top
        docs.sort((a, b) => {
          const timeA = a.scheduledStart || a.selectedTime ? new Date(a.scheduledStart || a.selectedTime || '').getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.scheduledStart || b.selectedTime ? new Date(b.scheduledStart || b.selectedTime || '').getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeB - timeA;
        });
        setSessions(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching member sessions:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const filteredSessions = sessions.filter(s => matchesRosterFilter(s.status, filter));

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-40">
      <div className="max-w-7xl mx-auto px-6 w-full pt-16">
        
        {/* Breadcrumbs */}
        <div className="mb-6 font-sans text-xs font-bold uppercase tracking-widest text-primary/50 flex items-center justify-between">
          <span>MEMBER PORTAL &gt; CONSULTATIONS</span>
          <Link 
            to="/member/request" 
            className={tertiaryLinkClass}
          >
            + Request New Consultation
          </Link>
        </div>

        {/* Header */}
        <div className="mb-10">
          <PageTitle className="mb-3">
            Consultations
          </PageTitle>
        </div>

        {/* F3: Nearest Upcoming Consultation Banner (re-evaluated on 60-second interval) */}
        <UpcomingConsultationBanner consultations={sessions} role="member" loading={loading} />

        {/* Member Consultations Ledger */}
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-sans text-sm font-bold uppercase tracking-widest text-primary">
                Your Consultations &amp; Appointments Ledger
              </h3>
              <p className="font-sans text-xs text-primary/60 mt-0.5">
                {filteredSessions.length} total
              </p>
            </div>

            {/* F4: RosterFilterChips identically matching pastor roster */}
            <RosterFilterChips activeFilter={filter} onFilterChange={setFilter} />
          </div>

          <div className="bg-white rounded-xl border border-primary/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-sm">
                <thead>
                  <tr className="border-b border-primary/10 bg-[#faf8f5]">
                    <th className="px-6 py-4 font-semibold text-primary/70 text-xs uppercase tracking-wider">Date &amp; Time</th>
                    <th className="px-6 py-4 font-semibold text-primary/70 text-xs uppercase tracking-wider">Counselor / Leader</th>
                    <th className="px-6 py-4 font-semibold text-primary/70 text-xs uppercase tracking-wider">Session Category</th>
                    <th className="px-6 py-4 font-semibold text-primary/70 text-xs uppercase tracking-wider">Format</th>
                    <th className="px-6 py-4 font-semibold text-primary/70 text-xs uppercase tracking-wider">Status</th>
                    <th className="w-48 px-6 py-4 font-semibold text-primary/70 text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-primary/50">
                        <Loader2 className="animate-spin mx-auto mb-2 text-primary/30" size={24} />
                        Loading appointments...
                      </td>
                    </tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-primary/50 text-sm">
                        No {FILTER_EMPTY_NAMES[filter]} consultations.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const isInPerson = session.meetingMethod === 'in_person';
                      return (
                        <tr 
                          key={session.id} 
                          className="hover:bg-primary/[0.02] transition-colors group"
                        >
                          <td className="px-6 py-4 text-primary whitespace-nowrap">
                            <div className="font-medium">
                              {session.selectedTime ? formatDateTime(session.selectedTime, 'date') : 'Date Pending'}
                            </div>
                            <div className="text-xs text-primary/60">
                              {session.selectedTime ? formatDateTime(session.selectedTime, 'time') : 'Awaiting Review'}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#1c202e]/10 text-primary font-sans flex items-center justify-center text-xs font-semibold">
                                {getInitials(session.leaderName)}
                              </div>
                              <span className="text-primary font-medium">
                                {session.leaderName || 'Pastoral Office'}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-primary whitespace-nowrap font-medium">
                            {session.category}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs font-medium">
                            <FormatChip method={session.meetingMethod} />
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={session.status} />
                          </td>

                          <td className="w-48 px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {!isInPerson && session.status === 'scheduled' && (
                                <JoinSessionButton
                                  consultationId={session.id}
                                  initialMeetingLink={session.meetingLink}
                                  buttonText="Join"
                                  loadingText="Joining..."
                                  icon={<Video size={13} />}
                                  showTestButton={false}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#1c202e] text-white text-xs font-semibold rounded hover:bg-[#1c202e]/90 transition-colors shadow-sm cursor-pointer disabled:opacity-75 min-w-[64px]"
                                />
                              )}
                              <Link
                                to={`/member/request/${session.id}`}
                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#faf8f5] hover:bg-primary/5 text-primary text-xs font-semibold rounded border border-primary/15 transition-colors min-w-[76px]"
                              >
                                Details
                                <ArrowRight size={12} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pre-Consultation Preparation Guide */}
        <div className="mb-16">
          <h3 className="font-sans text-sm font-bold uppercase tracking-widest text-primary mb-6">
            Consultation Preparation Checklist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-8 border border-primary/10 shadow-sm flex flex-col gap-3">
              <MapPin className="text-[#b93c3c] mb-1" size={20} />
              <h4 className="font-serif text-xl text-primary">Private Location</h4>
              <p className="font-sans text-sm text-primary/70 leading-relaxed">
                Choose a quiet, undisturbed room to ensure your conversation remains peaceful and completely confidential.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border border-primary/10 shadow-sm flex flex-col gap-3">
              <BookOpen className="text-[#b93c3c] mb-1" size={20} />
              <h4 className="font-serif text-xl text-primary">Bible &amp; Notebook</h4>
              <p className="font-sans text-sm text-primary/70 leading-relaxed">
                Keep your Bible and a notepad ready for scriptural guidance, prayer directives, and pastoral insights.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border border-primary/10 shadow-sm flex flex-col gap-3">
              <Heart className="text-[#b93c3c] mb-1" size={20} />
              <h4 className="font-serif text-xl text-primary">Prayer &amp; Peace</h4>
              <p className="font-sans text-sm text-primary/70 leading-relaxed">
                Enter your consultation with an open heart. Our pastoral counselors are committed to walking with you in faith.
              </p>
            </div>
          </div>
        </div>

        {/* Trust & Privacy Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-8 border border-primary/10 flex flex-col gap-3 shadow-sm">
            <Lock className="text-[#b93c3c] mb-1" size={20} />
            <h4 className="font-serif text-xl text-primary">Confidential Counsel</h4>
            <p className="font-sans text-sm text-primary/70 leading-relaxed">
              All appointments and spiritual counsel remain strictly protected under pastoral non-disclosure.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-8 border border-primary/10 flex flex-col gap-3 shadow-sm">
            <ShieldCheck className="text-[#b93c3c] mb-1" size={20} />
            <h4 className="font-serif text-xl text-primary">Immutable Privacy</h4>
            <p className="font-sans text-sm text-primary/70 leading-relaxed">
              Session records and reflection notes are restricted to your secure account and your assigned spiritual counselor.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-8 border border-primary/10 flex flex-col gap-3 shadow-sm">
            <ScrollText className="text-[#b93c3c] mb-1" size={20} />
            <h4 className="font-serif text-xl text-primary">Pastoral Covenant</h4>
            <p className="font-sans text-sm text-primary/70 leading-relaxed">
              Every counselor on this platform adheres to biblical standards of pastoral confidentiality and care.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}



