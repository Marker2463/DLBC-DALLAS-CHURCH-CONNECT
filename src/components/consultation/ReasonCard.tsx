import { useState } from 'react';
import { Consultation } from '../../types/consultation';
import { getInitials } from '../../lib/canonical';

interface ReasonCardProps {
  role: 'member' | 'pastor' | 'leader';
  consultation: Consultation;
  isLocked?: boolean;
  onSaveReason?: (newReason: string) => Promise<void> | void;
}

export function ReasonCard({
  role,
  consultation,
  isLocked = true,
  onSaveReason
}: ReasonCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [reasonDraft, setReasonDraft] = useState(consultation.reason || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onSaveReason) return;
    setIsSaving(true);
    try {
      await onSaveReason(reasonDraft);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const title = role === 'member' 
    ? 'Your Reason for Consultation' 
    : "Member's Reason for Consultation";

  const memberName = consultation.memberName || 'Member';
  const memberInitials = getInitials(memberName);

  return (
    <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl text-primary">{title}</h2>
        {role === 'member' && !isLocked && onSaveReason && (
          <button 
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-primary hover:text-primary-muted text-xs font-sans uppercase tracking-widest font-medium transition-colors cursor-pointer"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {/* Member Avatar & Identity */}
      <div className="flex items-start gap-4 mb-6">
        <div 
          aria-hidden="true"
          className="w-12 h-12 rounded-full bg-surface-dim flex items-center justify-center font-sans font-semibold text-primary shrink-0 uppercase text-sm border border-primary/10"
        >
          {memberInitials}
        </div>
        <div className="min-w-0">
          <h3 className="font-sans text-base font-semibold text-primary break-words">
            {memberName}
          </h3>
          <p className="font-sans text-xs text-primary-muted break-all">
            {role === 'member' ? 'You' : (consultation.memberEmail || 'Member')}
          </p>
        </div>
      </div>

      {/* Quote Block or Edit Box */}
      {isEditing ? (
        <div className="flex flex-col gap-3 mb-8">
          <label htmlFor="reason-edit-textarea" className="sr-only">
            Edit your reason for consultation
          </label>
          <textarea
            id="reason-edit-textarea"
            aria-label="Edit your reason for consultation"
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            className="w-full bg-[#faf8f5] border border-primary/20 rounded-md p-4 font-sans text-sm text-primary focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all resize-y min-h-[120px]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 min-h-[44px] bg-[#1c202e] text-white rounded-lg text-sm font-semibold hover:bg-[#1c202e]/90 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm font-sans text-primary mb-8 border-l-2 border-primary/20 pl-6 py-2 italic whitespace-pre-wrap bg-[#faf8f5] rounded-r-lg break-words">
          "{consultation.reason && consultation.reason.trim() && consultation.reason !== 'No description provided.'
            ? consultation.reason 
            : 'No additional details provided.'}"
        </div>
      )}

      {/* 3-Column MetaRow: URGENCY | CATEGORY | TIMELINE STAGE */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-6 border-t border-primary/10 pt-6">
        <div>
          <span className="block font-sans text-xs text-primary-muted uppercase tracking-widest mb-1">
            Urgency
          </span>
          <span className={`font-sans text-sm font-semibold uppercase ${
            consultation.urgency === 'high' ? 'text-red-700' : 'text-primary'
          }`}>
            {consultation.urgency || 'Normal'}
          </span>
        </div>
        <div>
          <span className="block font-sans text-xs text-primary-muted uppercase tracking-widest mb-1">
            Category
          </span>
          <span className="font-sans text-sm font-semibold text-primary">
            {consultation.category}
          </span>
        </div>
        <div>
          <span className="block font-sans text-xs text-primary-muted uppercase tracking-widest mb-1">
            Timeline Stage
          </span>
          <span className="font-sans text-sm font-semibold text-primary capitalize">
            {consultation.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </div>
  );
}
