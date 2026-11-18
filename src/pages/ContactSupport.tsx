import React, { useState } from 'react';
import { Mail, Wrench, AlertCircle, ArrowRight } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';

const INQUIRY_TYPES = [
  {
    id: 'general',
    title: 'General Inquiry',
    subtitle: 'Questions about our ministries or programs.',
    icon: Mail,
    urgent: false,
  },
  {
    id: 'technical',
    title: 'Technical Support',
    subtitle: 'Issues with your account or platform access.',
    icon: Wrench,
    urgent: false,
  },
  {
    id: 'emergency',
    title: 'Pastoral Emergency',
    subtitle: 'Immediate spiritual or pastoral assistance.',
    icon: AlertCircle,
    urgent: true,
  },
] as const;

export function ContactSupport() {
  const { showToast } = useToast();
  const [selectedType, setSelectedType] = useState<'general' | 'technical' | 'emergency'>('general');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !email.trim() || !message.trim()) {
      showToast({
        variant: 'warning',
        title: 'Missing Details',
        message: 'Please fill in your subject, email address, and message before submitting.',
      });
      return;
    }

    const typeLabel = INQUIRY_TYPES.find((t) => t.id === selectedType)?.title || 'Support';
    showToast({
      variant: 'success',
      title: `${typeLabel} Received`,
      message: `Thank you. Our stewardship team will respond to ${email.trim()} shortly.`,
    });
    setSubject('');
    setMessage('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-10 sm:py-16 pb-28 sm:pb-32">
      {/* Header */}
      <div className="mb-10 sm:mb-16">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-primary mb-4 sm:mb-6 tracking-tight">Contact Support</h1>
        <p className="font-sans text-base sm:text-lg text-primary-muted leading-relaxed max-w-2xl">
          Our pastoral care and technical stewardship teams are here to assist you. Please select the nature of your inquiry so we can route it with care.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Contact Methods */}
        <section aria-labelledby="inquiry-types-heading" className="md:col-span-5 flex flex-col gap-4">
          <h2 id="inquiry-types-heading" className="sr-only">Inquiry Types</h2>
          {INQUIRY_TYPES.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedType(item.id)}
                className={`text-left rounded-xl p-5 sm:p-6 transition-all cursor-pointer group ${
                  item.urgent
                    ? isSelected
                      ? 'bg-secondary/10 border-2 border-secondary shadow-sm'
                      : 'bg-surface border border-secondary/30 hover:bg-secondary/5'
                    : isSelected
                    ? 'bg-surface-dim/70 border-2 border-primary shadow-sm'
                    : 'bg-surface halo-border hover:bg-surface-dim/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      item.urgent ? 'bg-secondary/10 text-secondary' : 'bg-primary/5 text-primary'
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-sans text-base font-semibold transition-colors ${
                        item.urgent ? 'text-secondary' : 'text-primary group-hover:text-secondary'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={`font-sans text-sm ${
                        item.urgent ? 'text-secondary font-medium' : 'text-primary-muted'
                      }`}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {/* Right Column: Contact Form */}
        <div className="md:col-span-7">
          <div className="bg-surface rounded-xl p-5 sm:p-8 halo-border">
            <h2 className="font-serif text-2xl text-primary mb-6">Send a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="support-subject" className="block font-sans text-sm font-medium text-primary mb-2">Subject</label>
                <input 
                  id="support-subject"
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                  className="w-full bg-background border border-primary/20 rounded-md p-3.5 sm:p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/60 transition-all placeholder:text-primary-muted"
                />
              </div>
              <div>
                <label htmlFor="support-email" className="block font-sans text-sm font-medium text-primary mb-2">Email Address</label>
                <input 
                  id="support-email"
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-background border border-primary/20 rounded-md p-3.5 sm:p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/60 transition-all placeholder:text-primary-muted"
                />
              </div>
              <div>
                <label htmlFor="support-message" className="block font-sans text-sm font-medium text-primary mb-2">Message</label>
                <textarea 
                  id="support-message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please provide details..."
                  className="w-full bg-background border border-primary/20 rounded-md p-3.5 sm:p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/60 transition-all resize-y placeholder:text-primary-muted"
                />
              </div>
              <button 
                type="submit"
                className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-white font-sans text-sm font-medium py-3.5 sm:py-4 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active-sink"
              >
                Submit Request <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
