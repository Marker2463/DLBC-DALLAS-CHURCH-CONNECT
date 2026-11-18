import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { UserRole } from '../../lib/firebase';
import { Loader2 } from 'lucide-react';

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function RequireRole({ children, allowedRoles }: RequireRoleProps) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50dvh]">
        <Loader2 className="animate-spin text-primary/40" size={36} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Determine user's home dashboard based on role
  const getHomeDashboard = (currentRole: UserRole | null): string => {
    switch (currentRole) {
      case 'admin':
        return '/admin/roles';
      case 'pastor':
        return '/pastor/dashboard';
      case 'leader':
        return '/leader/dashboard';
      case 'member':
      default:
        return '/member/dashboard';
    }
  };

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={getHomeDashboard(role)} replace />;
  }

  return <>{children}</>;
}
