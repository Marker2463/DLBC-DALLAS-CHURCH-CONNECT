import React from 'react';
import { Lock, Send } from 'lucide-react';
import { ConsultationNote, Consultation } from '../../types/consultation';
import { formatDateTime } from '../../lib/canonical';

interface NotesCardProps {
  role: 'member' | 'pastor' | 'leader';
  consultation: Consultation;
  notes: ConsultationNote[];
  newNote: string;
  onNewNoteChange: (val: string) => void;
  onAddNote: (e: React.FormEvent) => void;
  currentUserId?: string;
}

export function NotesCard({
  role,
  consultation,
  notes,
  newNote,
  onNewNoteChange,
  onAddNote,
  currentUserId
}: NotesCardProps) {
  const otherParty = role === 'member'
    ? (consultation.leaderName || 'Pastor Samuel Olatunji')
    : (consultation.memberName || 'the member');

  return (
    <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border flex flex-col">
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-primary mb-1.5">Notes &amp; Updates</h2>
        <div className="flex items-center gap-1.5 text-xs text-primary-muted font-sans">
          <Lock size={13} className="text-primary-muted shrink-0" aria-hidden="true" />
          <span>Visible only to you and {otherParty}</span>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto max-h-[300px] mb-6 space-y-4 pr-2">
        {notes.length === 0 ? (
          <p className="text-sm font-sans text-primary-muted italic py-4">No notes yet.</p>
        ) : (
          notes.map((note) => {
            const isSelf = note.authorId === currentUserId || (role === 'member' && note.authorRole === 'member') || ((role === 'pastor' || role === 'leader') && note.authorRole !== 'member');
            return (
              <div 
                key={note.id} 
                className={`p-4 rounded-xl transition-all ${
                  isSelf 
                    ? 'bg-[#faf8f5] border border-primary/10 ml-4' 
                    : 'bg-primary/5 mr-4 border border-primary/5'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-sans text-xs font-bold text-primary">
                    {note.authorRole === 'member' 
                      ? (role === 'member' ? 'You' : consultation.memberName || 'Member')
                      : (role === 'pastor' || role === 'leader' ? 'You' : consultation.leaderName || 'Pastor/Leader')}
                  </span>
                  <span className="font-sans text-[11px] text-primary-muted">
                    {formatDateTime(note.createdAt, 'time')}
                  </span>
                </div>
                <p className="font-sans text-sm text-primary leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Add Note Form */}
      <form onSubmit={onAddNote} className="relative mt-auto">
        <label htmlFor="secure-note-input" className="sr-only">
          Add a secure note
        </label>
        <input 
          id="secure-note-input"
          type="text" 
          aria-label="Add a secure note"
          value={newNote}
          onChange={(e) => onNewNoteChange(e.target.value)}
          placeholder="Add a secure note..."
          className="w-full bg-[#faf8f5] border border-primary/20 rounded-xl py-3 pl-4 pr-12 font-sans text-sm text-primary placeholder:text-primary-muted focus:outline-none focus:border-primary/60 min-h-[44px]"
        />
        <button 
          type="submit" 
          aria-label="Send note" 
          disabled={!newNote.trim()} 
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-primary-muted hover:text-primary disabled:opacity-30 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
