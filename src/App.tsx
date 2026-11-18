/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/layout/Layout';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
import { Landing } from './pages/Landing';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Dashboard } from './pages/member/Dashboard';
import { Request } from './pages/member/Request';
import { PastorDashboard } from './pages/pastor/Dashboard';
import { LeaderDashboard } from './pages/leader/Dashboard';
import { PastorAvailability } from './pages/pastor/Availability';
import { MemberRequestDetail } from './pages/member/RequestDetail';
import { PastorRequestDetail } from './pages/pastor/RequestDetail';
import { PastorArchives } from './pages/pastor/Archives';
import { Ministry } from './pages/Ministry';
import { Leadership } from './pages/Leadership';
import { Process } from './pages/Process';
import { Resources } from './pages/Resources';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { MinistryGuidelines } from './pages/MinistryGuidelines';
import { TermsOfService } from './pages/TermsOfService';
import { ContactSupport } from './pages/ContactSupport';
import { MemberSanctuary } from './pages/member/Sanctuary';
import { PastorSanctuary } from './pages/pastor/Sanctuary';
import { Roles } from './pages/admin/Roles';
import { AuthProvider } from './lib/AuthContext';
import { RequireRole } from './components/auth/RequireRole';
import Settings from './pages/Settings';
import { ToastProvider } from './components/ui/ToastProvider';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
          <Route path="/terms" element={<TermsOfService />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="ministry" element={<Ministry />} />
            <Route path="ministry-guidelines" element={<MinistryGuidelines />} />
            <Route path="leadership" element={<Leadership />} />
            <Route path="process" element={<Process />} />
            <Route path="resources" element={<Resources />} />
            <Route path="privacy" element={<PrivacyPolicy />} />
            <Route path="support" element={<ContactSupport />} />
            <Route path="auth/login" element={<Login />} />
            <Route path="auth/register" element={<Register />} />
            
            {/* Member Routes */}
            <Route path="member/dashboard" element={<RequireRole allowedRoles={['member', 'admin']}><Dashboard /></RequireRole>} />
            <Route path="member/request" element={<RequireRole allowedRoles={['member', 'admin']}><Request /></RequireRole>} />
            <Route path="member/request/:id" element={<RequireRole allowedRoles={['member', 'admin']}><MemberRequestDetail /></RequireRole>} />
            <Route path="member/sanctuary" element={<RequireRole allowedRoles={['member', 'admin']}><MemberSanctuary /></RequireRole>} />
            
            {/* Leader & Pastor Routes */}
            <Route path="leader/dashboard" element={<RequireRole allowedRoles={['leader', 'pastor', 'admin']}><LeaderDashboard /></RequireRole>} />
            <Route path="pastor/dashboard" element={<RequireRole allowedRoles={['pastor', 'leader', 'admin']}><PastorDashboard /></RequireRole>} />
            <Route path="pastor/availability" element={<RequireRole allowedRoles={['pastor', 'leader', 'admin']}><PastorAvailability /></RequireRole>} />
            <Route path="pastor/request/:id" element={<RequireRole allowedRoles={['pastor', 'leader', 'admin']}><PastorRequestDetail /></RequireRole>} />
            <Route path="pastor/archives" element={<RequireRole allowedRoles={['pastor', 'leader', 'admin']}><PastorArchives /></RequireRole>} />
            <Route path="pastor/sanctuary" element={<RequireRole allowedRoles={['pastor', 'leader', 'admin']}><PastorSanctuary /></RequireRole>} />
            
            {/* Admin Routes */}
            <Route path="admin/roles" element={<RequireRole allowedRoles={['admin']}><Roles /></RequireRole>} />
            
            {/* Settings & Google Calendar Connection Routes */}
            <Route path="settings" element={<RequireRole allowedRoles={['member', 'pastor', 'leader', 'admin']}><Settings /></RequireRole>} />
            <Route path="pastor/settings" element={<RequireRole allowedRoles={['pastor', 'leader', 'admin']}><Settings /></RequireRole>} />
          </Route>
        </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
