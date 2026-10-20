import { Mail, Wrench, AlertCircle, ArrowRight } from 'lucide-react';

export function ContactSupport() {
  return (
    <div className="max-w-7xl mx-auto px-6 w-full py-16 pb-32">
      {/* Header */}
      <div className="mb-16">
        <h1 className="font-serif text-5xl md:text-6xl text-primary mb-6 tracking-tight">Contact Support</h1>
        <p className="font-sans text-lg text-primary-muted leading-relaxed max-w-2xl">
          Our pastoral care and technical stewardship teams are here to assist you. Please select the nature of your inquiry so we can route it with care.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Contact Methods */}
        <section aria-labelledby="inquiry-types-heading" className="md:col-span-5 flex flex-col gap-4">
          <h2 id="inquiry-types-heading" className="sr-only">Inquiry Types</h2>
          <div className="bg-surface rounded-xl p-6 halo-border cursor-pointer hover:bg-surface-dim transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                <Mail size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-sans text-base font-semibold text-primary group-hover:text-secondary transition-colors">General Inquiry</h3>
                <p className="font-sans text-sm text-primary-muted">Questions about our ministries or programs.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface rounded-xl p-6 halo-border cursor-pointer hover:bg-surface-dim transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                <Wrench size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-sans text-base font-semibold text-primary group-hover:text-secondary transition-colors">Technical Support</h3>
                <p className="font-sans text-sm text-primary-muted">Issues with your account or platform access.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface border border-secondary/30 rounded-xl p-6 cursor-pointer hover:bg-secondary/5 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-sans text-base font-semibold text-secondary">Pastoral Emergency</h3>
                <p className="font-sans text-sm text-secondary font-semibold">Immediate spiritual or pastoral assistance.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Contact Form */}
        <div className="md:col-span-7">
          <div className="bg-surface rounded-xl p-8 halo-border">
            <h2 className="font-serif text-2xl text-primary mb-6">Send a Message</h2>
            <form className="space-y-6">
              <div>
                <label htmlFor="support-subject" className="block font-sans text-sm font-medium text-primary mb-2">Subject</label>
                <input 
                  id="support-subject"
                  type="text" 
                  placeholder="How can we help?"
                  className="w-full bg-background border border-primary/20 rounded-md p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/60 transition-all placeholder:text-primary-muted"
                />
              </div>
              <div>
                <label htmlFor="support-email" className="block font-sans text-sm font-medium text-primary mb-2">Email Address</label>
                <input 
                  id="support-email"
                  type="email" 
                  placeholder="your@email.com"
                  className="w-full bg-background border border-primary/20 rounded-md p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/60 transition-all placeholder:text-primary-muted"
                />
              </div>
              <div>
                <label htmlFor="support-message" className="block font-sans text-sm font-medium text-primary mb-2">Message</label>
                <textarea 
                  id="support-message"
                  rows={5}
                  placeholder="Please provide details..."
                  className="w-full bg-background border border-primary/20 rounded-md p-4 font-sans text-sm text-primary focus:outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/60 transition-all resize-y placeholder:text-primary-muted"
                />
              </div>
              <button 
                type="button"
                className="w-full bg-primary hover:bg-primary/90 text-white font-sans text-sm font-medium py-4 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active-sink"
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
