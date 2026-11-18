import { 
  AlertTriangle, Phone,
  Book, Brain, Users, FileCheck, 
  Clock, Download, Eye 
} from 'lucide-react';
import { PageTitle } from '../components/PageTitle';
import { Popover } from '../components/ui/Popover';
import { useToast } from '../components/ui/ToastProvider';

export function Resources() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-10 sm:py-16 pb-28 sm:pb-32">
      <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
        <PageTitle className="mb-4 sm:mb-6">Spiritual Resources</PageTitle>
        <p className="font-sans text-base sm:text-lg text-primary-muted leading-relaxed max-w-2xl mx-auto">
          A curated library of tools, guides, and reflective materials designed to support your pastoral journey and personal stewardship.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-12 sm:gap-y-16 max-w-5xl mx-auto mb-16 sm:mb-24">
        
        {/* Prayer Guides */}
        <div>
          <div className="flex justify-between items-end border-b border-primary/10 pb-4 mb-6">
            <h2 className="font-serif text-2xl text-primary">Prayer Guides</h2>
            <Book size={20} className="text-primary-muted mb-1 shrink-0" />
          </div>
          <div className="space-y-4 sm:space-y-6">
            <ResourceItem title="Morning Liturgy of the Hours" time="15 min read" action="download" />
            <ResourceItem title="Prayers for Times of Uncertainty" time="10 min read" action="view" />
            <ResourceItem title="Intercessory Frameworks" time="25 min read" action="download" />
          </div>
        </div>

        {/* Mental Health */}
        <div>
          <div className="flex justify-between items-end border-b border-primary/10 pb-4 mb-6">
            <h2 className="font-serif text-2xl text-primary">Mental Health</h2>
            <Brain size={20} className="text-primary-muted mb-1 shrink-0" />
          </div>
          <div className="space-y-4 sm:space-y-6">
            <ResourceItem title="Recognizing Burnout in Ministry" time="20 min read" action="view" />
            <ResourceItem title="Establishing Healthy Boundaries" time="12 min read" action="download" />
            <ResourceItem title="Sabbath Practices for Leaders" time="18 min read" action="download" />
          </div>
        </div>

        {/* Family Stewardship */}
        <div>
          <div className="flex justify-between items-end border-b border-primary/10 pb-4 mb-6">
            <h2 className="font-serif text-2xl text-primary">Family Stewardship</h2>
            <Users size={20} className="text-primary-muted mb-1 shrink-0" />
          </div>
          <div className="space-y-4 sm:space-y-6">
            <ResourceItem title="Balancing Vocation and Home" time="15 min read" action="view" />
            <ResourceItem title="Financial Planning for Pastors" time="30 min read" action="download" />
          </div>
        </div>

        {/* Ministry Guidelines */}
        <div>
          <div className="flex justify-between items-end border-b border-primary/10 pb-4 mb-6">
            <h2 className="font-serif text-2xl text-primary">Ministry Guidelines</h2>
            <FileCheck size={20} className="text-primary-muted mb-1 shrink-0" />
          </div>
          <div className="space-y-4 sm:space-y-6">
            <ResourceItem title="Ethical Conduct in Counseling" time="45 min read" action="download" />
            <ResourceItem title="Safeguarding Protocols (2024 Update)" time="60 min read" action="download" />
          </div>
        </div>

      </div>

      {/* Immediate Support */}
      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-5 sm:p-8 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 text-secondary">
            <AlertTriangle size={22} fill="currentColor" className="text-secondary shrink-0" />
            <h2 className="font-serif text-2xl sm:text-3xl">Emergency &amp; Crisis Support</h2>
          </div>
          <Popover
            title="Platform Scope & Emergency Disclaimer"
            triggerLabel="Disclaimer"
            align="right"
            widthClass="sm:w-96"
            triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-secondary/25 bg-white px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <p>
              DLBC Church Connect is a volunteer-led pastoral consultation platform and does not provide 24/7 acute crisis or emergency response.
            </p>
            <p>
              If you or someone in your care is experiencing an acute crisis, medical emergency, or immediate threat of harm, please contact emergency services right away.
            </p>
          </Popover>
        </div>
        <p className="font-sans text-sm sm:text-base text-primary-muted mb-6 max-w-2xl leading-relaxed">
          For urgent medical emergencies or immediate crisis care, reach emergency services directly:
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          <a 
            href="tel:911" 
            className="w-full sm:w-auto min-h-[44px] bg-[#b93c3c] hover:bg-[#a83232] text-white font-sans text-sm font-semibold px-6 py-3 rounded-lg active-sink flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap"
          >
            <Phone size={18} />
            Call Emergency Services (911)
          </a>
          <a 
            href="tel:988" 
            className="w-full sm:w-auto min-h-[44px] bg-white hover:bg-primary/5 border border-primary/20 text-primary font-sans text-sm font-semibold px-6 py-3 rounded-lg active-sink flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Phone size={18} className="text-primary-muted" />
            Suicide &amp; Crisis Lifeline (988)
          </a>
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ title, time, action }: { title: string; time: string; action: 'download' | 'view' }) {
  const { showToast } = useToast();

  return (
    <button
      type="button"
      onClick={() =>
        showToast({
          variant: 'info',
          title: action === 'download' ? 'Preparing Guide' : 'Opening Resource',
          message: `"${title}" is available through your church resource desk during pastoral sessions.`,
        })
      }
      className="w-full text-left flex items-center justify-between gap-3 group cursor-pointer hover:bg-surface-dim/40 p-2.5 -mx-2.5 rounded-lg transition-colors"
    >
      <div className="min-w-0">
        <h3 className="font-sans text-sm font-medium text-primary mb-1 group-hover:text-secondary transition-colors break-words">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 text-primary-muted font-sans text-xs">
          <Clock size={14} className="shrink-0" />
          <span>{time}</span>
        </div>
      </div>
      <div className="text-primary-subtle group-hover:text-primary transition-colors shrink-0">
        {action === 'download' ? <Download size={18} /> : <Eye size={18} />}
      </div>
    </button>
  );
}
