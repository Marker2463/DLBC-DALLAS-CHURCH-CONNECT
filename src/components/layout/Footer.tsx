import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="w-full pt-12 sm:pt-16 pb-10 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-background mt-auto z-10 flex flex-col gap-6">
      <div className="font-serif text-2xl text-primary tracking-tight">DLBC Church Connect</div>
      
      <div className="w-full h-px bg-primary/10" />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 lg:gap-8">
        <div className="font-sans text-xs text-primary-muted max-w-md leading-relaxed">
          © {new Date().getFullYear()} DLBC Church Connect. Dedicated to digital stewardship and pastoral care.
        </div>
        
        <nav className="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-row xl:items-center gap-x-6 sm:gap-x-8 gap-y-3">
          <Link 
            to="/privacy" 
            className="font-sans text-xs text-primary-muted hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm py-0.5 sm:whitespace-nowrap"
          >
            Privacy Policy
          </Link>
          <Link 
            to="/terms" 
            className="font-sans text-xs text-primary-muted hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm py-0.5 sm:whitespace-nowrap"
          >
            Terms of Service
          </Link>
          <Link 
            to="/ministry-guidelines" 
            className="font-sans text-xs text-primary-muted hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm py-0.5 sm:whitespace-nowrap"
          >
            Ministry Guidelines
          </Link>
          <Link 
            to="/support" 
            className="font-sans text-xs text-primary-muted hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm py-0.5 sm:whitespace-nowrap"
          >
            Contact Support
          </Link>
          <a 
            href="tel:911" 
            className="font-sans text-xs text-primary-muted hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm py-0.5 sm:whitespace-nowrap"
          >
            Emergency Services (911)
          </a>
          <a 
            href="tel:988" 
            className="font-sans text-xs text-primary-muted hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm py-0.5 sm:whitespace-nowrap"
          >
            Suicide &amp; Crisis Lifeline (988)
          </a>
        </nav>
      </div>
    </footer>
  );
}
