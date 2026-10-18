import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="w-full pt-16 pb-12 px-6 flex flex-col gap-4 max-w-7xl mx-auto bg-background mt-auto z-10">
      <div className="font-serif text-2xl text-primary mb-8">DLBC Church Connect</div>
      
      <div className="w-full h-px bg-primary/10 mb-8" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="font-sans text-xs text-primary/70">
          © {new Date().getFullYear()} DLBC Church Connect. Dedicated to digital stewardship and pastoral care.
        </div>
        
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 whitespace-nowrap overflow-x-auto">
          <Link to="/privacy" className="font-sans text-xs text-primary/70 hover:text-primary transition-colors whitespace-nowrap">Privacy Policy</Link>
          <Link to="/terms" className="font-sans text-xs text-primary/70 hover:text-primary transition-colors whitespace-nowrap">Terms of Service</Link>
          <Link to="/ministry-guidelines" className="font-sans text-xs text-primary/70 hover:text-primary transition-colors whitespace-nowrap">Ministry Guidelines</Link>
          <Link to="/support" className="font-sans text-xs text-primary/70 hover:text-primary transition-colors whitespace-nowrap">Contact Support</Link>
          <a href="tel:911" className="font-sans text-xs text-primary/70 hover:text-primary transition-colors whitespace-nowrap">Emergency Services (911)</a>
          <a href="tel:988" className="font-sans text-xs text-primary/70 hover:text-primary transition-colors whitespace-nowrap">Suicide &amp; Crisis Lifeline (988)</a>
        </nav>
      </div>
    </footer>
  );
}
