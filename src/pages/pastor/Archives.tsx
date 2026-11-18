import { Link } from 'react-router-dom';
import { Archive, Loader2, Search, ChevronRight, Filter } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { db, Consultation } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { PageTitle } from '../../components/PageTitle';
import { getInitials, formatDateTime } from '../../lib/canonical';
import { StatusBadge } from '../../components/StatusBadge';

export function PastorArchives() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    
    // Query completed/archived consultations for this pastor
    const q = query(
      collection(db, 'consultations'),
      where('leaderId', '==', user.uid),
      where('status', 'in', ['completed', 'archived', 'cancelled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
      
      // Sort by selectedTime descending
      docs.sort((a, b) => {
        if (!a.selectedTime) return 1;
        if (!b.selectedTime) return -1;
        return new Date(b.selectedTime).getTime() - new Date(a.selectedTime).getTime();
      });
      setConsultations(docs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching archived consultations:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredConsultations = useMemo(() => {
    return consultations.filter((c) => {
      const matchesSearch = c.memberName?.toLowerCase().includes(searchQuery.toLowerCase()) || c.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [consultations, searchQuery, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(consultations.map(c => c.category));
    return Array.from(cats);
  }, [consultations]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-10 sm:py-16 pb-28 sm:pb-32">
      <div className="mb-8 sm:mb-12">
        <PageTitle className="mb-4">Records</PageTitle>
        <p className="font-sans text-base sm:text-lg text-primary-muted">
          A historical record of completed consultations and pastoral care sessions.
        </p>
      </div>

      <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border flex flex-col">
        <div className="flex flex-col gap-6 mb-8 border-b border-primary/10 pb-6">
          <div className="flex items-center gap-3 text-primary">
            <Archive size={20} className="text-primary-muted shrink-0" />
            <h2 className="font-serif text-xl sm:text-2xl text-primary">Completed Records</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="relative w-full max-w-md">
              <label htmlFor="records-search" className="sr-only">Search completed records</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted" size={14} />
              <input
                id="records-search"
                type="text"
                aria-label="Search by member name or session type"
                placeholder="Search by member name or session type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/80 border border-[#e2dcce] text-xs px-3 py-2.5 pl-9 rounded-lg focus:ring-1 focus:ring-[#8c2e2e] outline-none transition-all text-primary placeholder:text-primary-muted"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
              {['all', 'Spiritual Guidance', 'Youth Mentorship', 'Marriage Counseling'].map((tab) => {
                const label = tab === 'all' ? 'All Records' : tab;
                const isActive = categoryFilter === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setCategoryFilter(tab)}
                    className={`font-sans text-xs uppercase tracking-wider font-semibold transition-colors hover:text-primary relative cursor-pointer py-1 ${isActive ? 'text-primary' : 'text-primary-muted'}`}
                  >
                    {label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8c2e2e]"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6 flex-grow">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-primary-muted" size={32} />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="font-sans text-base text-red-700">We couldn't load archived records. Please refresh and try again.</p>
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <Archive className="mx-auto text-primary-muted mb-4 opacity-40" size={48} />
              <p className="font-sans text-base sm:text-lg text-primary-muted">No matching records found.</p>
            </div>
          ) : (
            filteredConsultations.map((consultation) => (
              <Link key={consultation.id} to={`/pastor/request/${consultation.id}`} className="flex items-start sm:items-center gap-3.5 sm:gap-4 pb-5 border-b border-primary/5 hover:bg-primary/5 p-3 sm:p-4 rounded-lg transition-colors group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-dim flex items-center justify-center font-sans text-primary shadow-sm shrink-0 uppercase text-xs sm:text-sm font-semibold border border-primary/10">
                  {getInitials(consultation.memberName)}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                    <h3 className="font-sans text-base font-semibold text-primary group-hover:text-secondary transition-colors break-words">{consultation.memberName}</h3>
                    <StatusBadge status={consultation.status} />
                  </div>
                  <p className="font-sans text-xs sm:text-sm text-primary-muted break-words">{consultation.category} • {consultation.selectedTime ? formatDateTime(consultation.selectedTime, 'date') : 'No date set'}</p>
                </div>
                <ChevronRight size={20} className="text-primary/20 group-hover:text-secondary transition-colors shrink-0 self-center" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
