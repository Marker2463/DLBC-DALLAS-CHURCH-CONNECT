import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';

export interface PageHeaderProps {
  role: 'member' | 'pastor';
  consultationId?: string;
  category?: string;
  personName?: string;
  status?: string;
  dashboardUrl?: string;
}

export function PageHeader({
  role,
  category = 'Spiritual Guidance',
  personName,
  status = 'under_review',
  dashboardUrl = role === 'member' ? '/member/dashboard' : '/pastor/dashboard',
}: PageHeaderProps) {
  return (
    <div className="mb-8 md:mb-10">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-primary-muted font-sans text-xs uppercase tracking-widest mb-3"
      >
        <Link
          to={dashboardUrl}
          className="hover:text-primary underline transition-colors cursor-pointer"
        >
          Dashboard
        </Link>
        <ChevronRight size={12} className="shrink-0 text-primary-muted" aria-hidden="true" />
        <span aria-current="page" className="tracking-widest">
          Consultation Details
        </span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-primary mb-2">
            Consultation: {category}
          </h1>
          <p className="font-sans text-sm text-primary-muted">
            {role === 'member' ? (
              <>
                With <strong className="text-primary font-semibold">{personName || 'Pastor Samuel Olatunji'}</strong>
              </>
            ) : (
              <>
                Requested by <strong className="text-primary font-semibold">{personName || 'Member'}</strong>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <StatusBadge status={status} />
        </div>
      </div>
    </div>
  );
}
