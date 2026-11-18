import { useState, useEffect, useMemo } from 'react';
import { db, UserProfile, LeaderAvailability } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Loader2, Calendar as CalendarIcon, Clock, Check, User, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { addDays, format, isSameDay } from 'date-fns';
import { getInitials } from '../../lib/canonical';
import { Popover } from '../ui/Popover';

interface StepScheduleProps {
  onSlotSelected: (leaderId: string, leaderName: string, selectedDate: Date, timeSlot: string, leaderEmail?: string) => void;
  selectedLeaderId: string | null;
  selectedTimeSlot: string | null;
  selectedDate: Date | null;
  category?: string;
}

const MIN_LEAD_HOURS = 1;

const DEFAULT_SLOTS = [
  "9:00 AM",
  "10:30 AM",
  "1:00 PM",
  "2:30 PM",
  "4:00 PM",
  "5:30 PM",
  "7:00 PM"
];

function parseSlotToDate(slotStr: string, baseDate: Date): Date {
  const result = new Date(baseDate);
  const trimmed = slotStr.trim();

  // 12-hour format e.g. "9:00 AM", "10:30 PM", "1:00 PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  // 24-hour format e.g. "09:00", "17:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  return result;
}

function isSlotBookable(slotStr: string, date: Date, now: Date = new Date()): boolean {
  if (!isSameDay(date, now)) {
    return true;
  }
  const slotDate = parseSlotToDate(slotStr, date);
  const cutoffTime = now.getTime() + MIN_LEAD_HOURS * 60 * 60 * 1000;
  return slotDate.getTime() > cutoffTime;
}

function getCategoryFilter(cat?: string): string {
  if (!cat) return 'All Leaders';
  const lower = cat.toLowerCase();
  if (lower.includes('youth')) return 'Youth Ministry';
  if (lower.includes('children') || lower.includes('child')) return 'Children Care';
  if (lower.includes('marriage') || lower.includes('spiritual') || lower.includes('bereavement') || lower.includes('transition')) return 'Pastoral Counsel';
  return 'All Leaders';
}

export function StepSchedule({ onSlotSelected, selectedLeaderId, selectedTimeSlot, selectedDate, category }: StepScheduleProps) {
  const [leaders, setLeaders] = useState<{ profile: UserProfile, availability: LeaderAvailability | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(() => getCategoryFilter(category));
  const [activeLeaderId, setActiveLeaderId] = useState<string | null>(selectedLeaderId);

  // Generate 7 days starting from today (today + next 6)
  const next7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  // Always include and default to today for immediate same-day pastoral access
  const [activeDay, setActiveDay] = useState<Date>(() => {
    if (selectedDate) return selectedDate;
    return new Date();
  });

  // Sync filter if category changes
  useEffect(() => {
    if (category) {
      setFilter(getCategoryFilter(category));
    }
  }, [category]);

  useEffect(() => {
    async function fetchLeadersAndAvailability() {
      try {
        const usersRef = collection(db, 'users');
        // Only fetch users with role pastor or leader (admins do not do consultations unless assigned pastor/leader)
        const q = query(usersRef, where('role', 'in', ['leader', 'pastor']));
        const usersSnap = await getDocs(q);

        const leadersData: UserProfile[] = [];
        usersSnap.forEach(doc => {
          const data = doc.data() as UserProfile;
          if (data.role !== 'leader' && data.role !== 'pastor') return;

          const lowerName = (data.displayName || '').toLowerCase();
          const lowerEmail = (data.email || '').toLowerCase();
          if (
            lowerName.includes('dummy') ||
            lowerName.includes('test leader') ||
            lowerName.includes('mock') ||
            lowerEmail.includes('dummy') ||
            lowerEmail.includes('fake')
          ) {
            return;
          }
          leadersData.push(data);
        });

        // Fetch availability for leaders
        const availabilityRef = collection(db, 'availability');
        const availabilitySnap = await getDocs(availabilityRef);

        const availabilityMap = new Map<string, LeaderAvailability>();
        availabilitySnap.forEach(doc => {
          availabilityMap.set(doc.id, doc.data() as LeaderAvailability);
        });

        const combined = leadersData.map(leader => ({
          profile: leader,
          availability: availabilityMap.get(leader.uid) || null
        }));

        setLeaders(combined);

        // Pick initial active leader
        if (!selectedLeaderId && combined.length > 0) {
          const initialFilter = getCategoryFilter(category);
          const initialMatch = combined.find(l => {
            if (initialFilter === 'Youth Ministry') return l.profile.leaderType === 'youth' || (l.profile.displayName || '').toLowerCase().includes('youth');
            if (initialFilter === 'Children Care') return l.profile.leaderType === 'children' || (l.profile.displayName || '').toLowerCase().includes('children');
            if (initialFilter === 'Pastoral Counsel') return l.profile.role === 'pastor' || l.profile.leaderType === 'pastoral';
            return true;
          });
          setActiveLeaderId((initialMatch || combined[0]).profile.uid);
        }
      } catch (err) {
        console.error("Failed to fetch leaders:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeadersAndAvailability();
  }, [category, selectedLeaderId]);

  const getDayName = (date: Date) => format(date, 'EEEE');
  const getFormattedDateForBlackout = (date: Date) => format(date, 'yyyy-MM-dd');

  const getSlotsForDay = (leaderId: string, date: Date): string[] => {
    const leader = leaders.find(l => l.profile.uid === leaderId);
    let slots = DEFAULT_SLOTS;

    if (leader) {
      if (leader.availability) {
        // Check blackout dates
        const dateString = getFormattedDateForBlackout(date);
        if (leader.availability.blackoutDates?.includes(dateString)) return [];

        const dayName = getDayName(date);
        const daySchedule = leader.availability.weeklySchedule?.[dayName];

        if (daySchedule) {
          if (!daySchedule.enabled) return [];
          if (daySchedule.slots && daySchedule.slots.length > 0) {
            slots = daySchedule.slots;
          }
        }
      } else if (format(date, 'EEEE') === 'Sunday') {
        slots = ["2:00 PM", "3:30 PM", "5:00 PM"];
      }
    } else if (format(date, 'EEEE') === 'Sunday') {
      slots = ["2:00 PM", "3:30 PM", "5:00 PM"];
    }

    // Filter bookable slots for today based on current time & MIN_LEAD_HOURS
    const now = new Date();
    if (isSameDay(date, now)) {
      return slots.filter(slot => isSlotBookable(slot, date, now));
    }

    return slots;
  };

  const filteredLeaders = useMemo(() => {
    const list = leaders.filter(l => {
      if (filter === 'All Leaders') return true;
      if (filter === 'Youth Ministry') return l.profile.leaderType === 'youth' || (l.profile.displayName || '').toLowerCase().includes('youth') || (l.profile.displayName || '').toLowerCase().includes('grace');
      if (filter === 'Children Care') return l.profile.leaderType === 'children' || (l.profile.displayName || '').toLowerCase().includes('children');
      if (filter === 'Pastoral Counsel') return l.role === 'pastor' || l.profile.role === 'pastor' || l.profile.leaderType === 'pastoral' || !l.profile.leaderType;
      return true;
    });

    // Fallback: if category filter yielded 0, return all leaders so user is never blocked
    return list.length > 0 ? list : leaders;
  }, [leaders, filter]);

  // Keep active leader in sync when filter switches
  useEffect(() => {
    if (filteredLeaders.length > 0) {
      const isCurrentInFiltered = filteredLeaders.some(l => l.profile.uid === activeLeaderId);
      if (!isCurrentInFiltered) {
        setActiveLeaderId(filteredLeaders[0].profile.uid);
      }
    }
  }, [filteredLeaders, activeLeaderId]);

  const currentLeader = leaders.find(l => l.profile.uid === (activeLeaderId || selectedLeaderId)) || filteredLeaders[0];
  const activeDaySlots = currentLeader ? getSlotsForDay(currentLeader.profile.uid, activeDay) : [];

  // Determine next available day for empty state message and navigation button
  const nextAvailableDay = useMemo(() => {
    if (!currentLeader) return null;
    const futureDays = next7Days.filter(d => d.getTime() > activeDay.getTime());
    for (const d of futureDays) {
      if (getSlotsForDay(currentLeader.profile.uid, d).length > 0) {
        return d;
      }
    }
    for (const d of next7Days) {
      if (!isSameDay(d, activeDay) && getSlotsForDay(currentLeader.profile.uid, d).length > 0) {
        return d;
      }
    }
    return null;
  }, [activeDay, next7Days, currentLeader, leaders]);

  const handleSelectLeader = (leaderId: string) => {
    setActiveLeaderId(leaderId);
    // If a time was already selected with a different leader, update with this leader
    if (selectedDate && selectedTimeSlot) {
      const leader = leaders.find(l => l.profile.uid === leaderId);
      if (leader) {
        onSlotSelected(leaderId, leader.profile.displayName, selectedDate, selectedTimeSlot, leader.profile.email);
      }
    }
  };

  const handleSelectTime = (time: string) => {
    if (!currentLeader) return;
    onSlotSelected(
      currentLeader.profile.uid,
      currentLeader.profile.displayName,
      activeDay,
      time,
      currentLeader.profile.email
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-primary/40 mr-2" size={28} />
        <span className="font-sans text-sm text-primary-muted">Loading counselors &amp; schedules...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Header Banner */}
      <div>
        <h2 className="font-serif text-3xl text-primary mb-2">Select Spiritual Leader &amp; Schedule</h2>
        <p className="font-sans text-sm text-primary-muted max-w-xl">
          {category ? `Showing counselors tailored for ${category}. ` : ''}
          Choose a pastoral counselor, pick a date, and select an available time for your consultation.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {['All Leaders', 'Pastoral Counsel', 'Youth Ministry', 'Children Care'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl font-sans text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${filter === f
                ? 'bg-[#1c202e] text-white shadow-sm'
                : 'bg-white border border-primary/15 text-primary-muted hover:text-primary hover:bg-primary/[0.04]'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Selected Appointment Confirmation Callout */}
      {selectedLeaderId && selectedDate && selectedTimeSlot && (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="min-w-0">
              <span className="block font-sans text-[11px] text-emerald-800 font-bold uppercase tracking-widest">
                Appointment Selected
              </span>
              <span className="font-sans text-sm text-emerald-950 font-medium break-words">
                {leaders.find(l => l.profile.uid === selectedLeaderId)?.profile.displayName || 'Selected Pastor'} • {format(selectedDate, 'EEE, MMM d')} at {selectedTimeSlot}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSlotSelected('', '', new Date(), '')}
            className="text-emerald-800 hover:text-emerald-950 p-2 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
            title="Clear Selection"
            aria-label="Clear Selection"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Two-Column Structured Booking Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Leader Selection (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-primary-muted">
              1. Choose Spiritual Leader ({filteredLeaders.length})
            </h3>
          </div>

          <div className="space-y-3">
            {filteredLeaders.map(leader => {
              const isSelected = (activeLeaderId || selectedLeaderId) === leader.profile.uid;
              const hasConfirmedSlot = selectedLeaderId === leader.profile.uid && selectedTimeSlot;

              return (
                <div
                  key={leader.profile.uid}
                  onClick={() => handleSelectLeader(leader.profile.uid)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${isSelected
                      ? 'bg-white border-[#1c202e] ring-2 ring-[#1c202e]/10 shadow-md'
                      : 'bg-white/80 hover:bg-white border-primary/10 hover:border-primary/25 shadow-sm'
                    }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-serif text-lg font-bold shrink-0 transition-colors ${isSelected ? 'bg-[#1c202e] text-white' : 'bg-primary/5 text-primary'
                      }`}>
                      {leader.profile.displayName ? getInitials(leader.profile.displayName) : <User size={18} />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-serif text-base text-primary font-semibold truncate">
                        {leader.profile.displayName}
                      </h4>
                      <p className="font-sans text-xs text-primary-muted truncate capitalize">
                        {leader.profile.leaderType ? `${leader.profile.leaderType} Ministry` : (leader.profile.role === 'pastor' ? 'Pastoral Counselor' : 'Ministry Leader')}
                      </p>
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Available
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {hasConfirmedSlot ? (
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Check size={14} />
                      </span>
                    ) : isSelected ? (
                      <span className="w-7 h-7 rounded-full bg-[#1c202e] text-white flex items-center justify-center">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-primary/5 text-primary-muted flex items-center justify-center">
                        <ChevronRight size={14} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredLeaders.length === 0 && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10 text-center font-sans text-sm text-primary-muted italic">
                No leaders match this category filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Schedule & Timeslots (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          <div className="bg-white rounded-2xl p-5 sm:p-6 md:p-8 border border-primary/10 shadow-sm flex flex-col gap-6">

            {/* Header info of selected counselor */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-primary/10 pb-4">
              <div className="min-w-0">
                <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-primary-muted">
                  2. Select Consultation Date &amp; Time
                </h3>
                <p className="font-serif text-lg text-primary font-semibold mt-1 break-words">
                  Schedule with {currentLeader?.profile.displayName || 'Spiritual Counselor'}
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 text-primary text-xs font-semibold whitespace-nowrap">
                  <CalendarIcon size={13} /> {format(activeDay, 'MMMM yyyy')}
                </span>
              </div>
            </div>

            {/* 7-Day Responsive Grid */}
            <div>
              <label className="block font-sans text-xs font-bold uppercase tracking-wider text-primary-muted mb-3">
                Select A Day (Next 7 Days)
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {next7Days.map((date, idx) => {
                  const isDaySelected = isSameDay(date, activeDay);
                  const slotsCount = currentLeader ? getSlotsForDay(currentLeader.profile.uid, date).length : 0;
                  const isToday = isSameDay(date, new Date());

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveDay(date)}
                      className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all text-center border cursor-pointer ${isDaySelected
                          ? 'bg-[#1c202e] text-white border-[#1c202e] shadow-md scale-[1.02]'
                          : 'bg-[#faf8f5] hover:bg-primary/[0.04] border-primary/10 text-primary'
                        }`}
                    >
                      <span className={`block font-sans text-xs font-bold uppercase tracking-widest ${isDaySelected ? 'text-white' : 'text-primary-muted'
                        }`}>
                        {isToday ? 'Today' : format(date, 'EEE')}
                      </span>
                      <span className={`block font-serif text-base font-bold my-0.5 ${isDaySelected ? 'text-white' : 'text-primary'
                        }`}>
                        {format(date, 'MMM d')}
                      </span>
                      {/* Redundant slot count removed: replaced with simple availability indicator */}
                      <span className={`block font-sans text-xs font-semibold ${isDaySelected
                          ? 'text-white/90'
                          : slotsCount > 0 ? 'text-emerald-700' : 'text-primary-muted'
                        }`}>
                        {slotsCount > 0 ? 'Slots' : 'No Slots'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Selection Grid */}
            <div>
              <div className="mb-3">
                <label
                  aria-label={`Available times for ${format(activeDay, 'EEE, MMM d')}`}
                  className="font-sans text-xs font-bold uppercase tracking-wider text-primary-muted block"
                >
                  Available Times — {format(activeDay, 'EEE, MMM d')}
                </label>
              </div>

              {/* Same-day pastoral care rule bar with Popover */}
              {isSameDay(activeDay, new Date()) && (
                <div className="mb-4 bg-amber-500/10 border border-amber-600/20 rounded-xl px-3.5 py-2.5 text-xs font-sans text-primary flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-amber-900">
                    <Clock size={14} className="text-amber-800 shrink-0" />
                    <span>Same-day care requires 1h notice</span>
                  </span>
                  <Popover
                    title="Same-Day Pastoral Care Policy"
                    triggerLabel="Details"
                    align="right"
                    triggerClassName="inline-flex items-center gap-1 rounded-md border border-amber-700/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <p>
                      Appointments scheduled for today require at least 1 hour advance notice so your pastor can prepare thoughtfully.
                    </p>
                    <p>
                      For urgent spiritual emergencies or bereavement, call the pastoral care line at{' '}
                      <span className="font-semibold text-primary whitespace-nowrap">(214) 555-DLBC</span>.
                    </p>
                  </Popover>
                </div>
              )}

              {activeDaySlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activeDaySlots.map((time, idx) => {
                    const formattedSlot = time.replace(/^0/, '');
                    const isTimeSelected =
                      selectedLeaderId === currentLeader?.profile.uid &&
                      selectedDate && isSameDay(selectedDate, activeDay) &&
                      (selectedTimeSlot === time || selectedTimeSlot === formattedSlot);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectTime(formattedSlot)}
                        className={`py-3.5 px-4 rounded-xl font-sans text-sm font-semibold transition-all flex items-center justify-center gap-2 border cursor-pointer ${isTimeSelected
                            ? 'bg-primary text-white border-primary shadow-md ring-2 ring-primary/20'
                            : 'bg-[#faf8f5] hover:bg-white text-primary border-primary/15 hover:border-primary/30 shadow-sm'
                          }`}
                      >
                        <Clock size={15} className={isTimeSelected ? 'text-white' : 'text-primary-muted'} />
                        {formattedSlot}
                        {isTimeSelected && <Check size={14} className="text-white ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              ) : (<></>
                // <div className="bg-[#faf8f5] rounded-xl p-8 border border-primary/10 text-center">
                //   <Clock className="mx-auto mb-2 text-primary-muted" size={24} />
                //   <p className="font-serif text-base text-primary mb-1">
                //     {isSameDay(activeDay, new Date()) ? (
                //       <>
                //         No remaining slots today ({format(activeDay, 'EEE, MMM d')}).
                //       </>
                //     ) : (
                //       <>
                //         No times available on {format(activeDay, 'EEE, MMM d')}.
                //       </>
                //     )}
                //   </p>
                //   <p className="font-sans text-xs text-primary-muted mb-4 max-w-md mx-auto">
                //     {isSameDay(activeDay, new Date())
                //       ? 'Same-day scheduled slots require 1 hour notice. For urgent pastoral care tonight, please reach our pastoral care line at (214) 555-DLBC.'
                //       : 'Please choose another day above to see available consultation slots.'}
                //   </p>
                //   {nextAvailableDay && (
                //     <button
                //       type="button"
                //       onClick={() => setActiveDay(nextAvailableDay)}
                //       className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1c202e] text-white text-xs font-semibold hover:bg-[#1c202e]/90 transition-colors cursor-pointer"
                //     >
                //       View Next Available: {format(nextAvailableDay, 'EEE, MMM d')}
                //     </button>
                //   )}
                // </div>
              )}
            </div>

            {/* Privacy & Confidentiality Footnote */}
            <div className="pt-4 border-t border-primary/10 flex flex-wrap items-center justify-between gap-2 text-xs text-primary-muted">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={13} className="text-primary shrink-0" /> Pastoral Confidentiality Guaranteed
              </span>
              <span className="whitespace-nowrap">All sessions 45 minutes</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

