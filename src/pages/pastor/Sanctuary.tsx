import { useState, useEffect } from 'react';
import { Lock, Video, Calendar, Clock, ArrowRight, ExternalLink, FileText, CheckCircle2, User, Loader2, RefreshCw, MapPin } from 'lucide-react';
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

export function PastorSanctuary() {
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

    // Query consultations assigned to this pastor/leader
    const q = query(
      collection(db, 'consultations'),
      where('leaderId', '==', user.uid)
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
        console.error("Error fetching pastor sessions:", err);
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
        <div className="mb-6 font-sans text-xs font-bold uppercase tracking-widest text-primary-muted flex items-center justify-between">
          <span>PASTORAL WORKSPACE &gt; CONSULTATIONS</span>
          <div className="flex items-center gap-4">
            <Link 
              to="/pastor/availability" 
              className={tertiaryLinkClass}
            >
              <Calendar size={13} />
              Manage Availability
            </Link>
            <span className="text-primary-subtle">•</span>
            <Link 
              to="/pastor/archives" 
              className={tertiaryLinkClass}
            >
              <FileText size={13} />
              Records
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="mb-10">
          <PageTitle className="mb-3">
            Consultations
          </PageTitle>
        </div>

        {/* F3: Nearest Upcoming Consultation Banner (re-evaluated on 60-second interval) */}
        <UpcomingConsultationBanner consultations={sessions} role="pastor" loading={loading} />

        {/* Assigned Sessions Ledger */}
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-sans text-sm font-bold uppercase tracking-widest text-primary">
                Assigned Consultations &amp; Session Roster
              </h2>
              <p className="font-sans text-xs text-primary-muted mt-0.5">
                {filteredSessions.length} total
              </p>
            </div>

            {/* Filter Tabs */}
            <RosterFilterChips activeFilter={filter} onFilterChange={setFilter} />
          </div>

          <div className="bg-white rounded-xl border border-primary/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-sm">
                <thead>
                  <tr className="border-b border-primary/10 bg-[#faf8f5]">
                    <th className="px-6 py-4 font-semibold text-primary-muted text-xs uppercase tracking-wider">Date &amp; Time</th>
                    <th className="px-6 py-4 font-semibold text-primary-muted text-xs uppercase tracking-wider">Member</th>
                    <th className="px-6 py-4 font-semibold text-primary-muted text-xs uppercase tracking-wider">Session Category</th>
                    <th className="px-6 py-4 font-semibold text-primary-muted text-xs uppercase tracking-wider">Format</th>
                    <th className="px-6 py-4 font-semibold text-primary-muted text-xs uppercase tracking-wider">Status</th>
                    <th className="w-48 px-6 py-4 font-semibold text-primary-muted text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-primary-muted">
                        <Loader2 className="animate-spin mx-auto mb-2 text-primary-muted" size={24} />
                        Loading assigned consultations...
                      </td>
                    </tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-primary-muted text-sm">
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
                              {session.selectedTime ? formatDateTime(session.selectedTime, 'date') : 'Pending Date'}
                            </div>
                            <div className="text-xs text-primary-muted">
                              {session.selectedTime ? formatDateTime(session.selectedTime, 'time') : 'Unscheduled'}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#1c202e]/10 text-primary font-serif flex items-center justify-center text-sm">
                                {session.memberName ? session.memberName.charAt(0).toUpperCase() : <User size={14} />}
                              </div>
                              <span className="text-primary font-medium">
                                {session.memberName || 'Congregation Member'}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-primary whitespace-nowrap">
                            <span className="font-medium">{session.category}</span>
                            {session.urgency === 'high' && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider">
                                Urgent
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-xs font-medium">
                            <FormatChip method={session.meetingMethod} />
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={session.status} />
                          </td>

                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {!isInPerson && session.status === 'scheduled' && (
                                <JoinSessionButton
                                  consultationId={session.id}
                                  initialMeetingLink={session.meetingLink}
                                  buttonText="Join"
                                  loadingText="Joining..."
                                  icon={<Video size={13} />}
                                  showTestButton={false}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1c202e] text-white text-xs font-semibold rounded hover:bg-[#1c202e]/90 transition-colors shadow-sm cursor-pointer disabled:opacity-75"
                                />
                              )}
                              
                              <Link
                                to={`/pastor/request/${session.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#faf8f5] hover:bg-primary/5 text-primary text-xs font-semibold rounded border border-primary/15 transition-colors"
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

        {/* Pastoral Support & Covenant Pillars */}
        <section aria-labelledby="pastoral-support-heading">
          <h2 id="pastoral-support-heading" className="sr-only">Pastoral Support &amp; Covenant Pillars</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-8 border border-primary/10 shadow-sm flex flex-col justify-between">
              <div>
                <Lock className="text-[#b93c3c] mb-3" size={22} />
                <h3 className="font-serif text-xl text-primary mb-1">Encrypted Confidentiality</h3>
                <p className="font-sans text-sm text-primary-muted leading-relaxed">
                  All consultation notes and pastoral reflections remain strictly confidential between you and the member.
                </p>
              </div>
              <Link to="/ministry-guidelines" className={`mt-4 ${tertiaryLinkClass}`}>
                Read Guidelines <ArrowRight size={12} />
              </Link>
            </div>

            <div className="bg-white rounded-xl p-8 border border-primary/10 shadow-sm flex flex-col justify-between">
              <div>
                <Calendar className="text-[#b93c3c] mb-3" size={22} />
                <h3 className="font-serif text-xl text-primary mb-1">Calendar Integration</h3>
                <p className="font-sans text-sm text-primary-muted leading-relaxed">
                  Sessions sync directly with your Google Calendar with automatic meeting link generation and reminders.
                </p>
              </div>
              <Link to="/pastor/availability" className={`mt-4 ${tertiaryLinkClass}`}>
                Update Timeslots <ArrowRight size={12} />
              </Link>
            </div>

            <div className="bg-white rounded-xl p-8 border border-primary/10 shadow-sm flex flex-col justify-between">
              <div>
                <FileText className="text-[#b93c3c] mb-3" size={22} />
                <h3 className="font-serif text-xl text-primary mb-1">Pastoral Case Notes</h3>
                <p className="font-sans text-sm text-primary-muted leading-relaxed">
                  Record spiritual notes, scriptural passages, and prayer points securely during or after each consultation.
                </p>
              </div>
              <Link to="/pastor/archives" className={`mt-4 ${tertiaryLinkClass}`}>
                View Records <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

