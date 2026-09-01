import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { LoadingScreen } from './components/common/LoadingScreen';
import { OfflineBanner } from './components/common/OfflineBanner';
import { InstallPrompt } from './components/common/InstallPrompt';
import { DashboardLayout } from './layouts/DashboardLayout';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const GatePassesPage = lazy(() => import('./pages/gate-passes/GatePassesPage'));
const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage'));
const InvoicePaymentPage = lazy(() => import('./pages/invoices/InvoicePaymentPage'));
const MessagesPage = lazy(() => import('./pages/messages/MessagesPage'));
const RequestsPage = lazy(() => import('./pages/requests/RequestsPage'));
const NewRequestPage = lazy(() => import('./pages/requests/NewRequestPage'));
const AnnouncementsPage = lazy(() => import('./pages/announcements/AnnouncementsPage'));
const AdvertisementsPage = lazy(() => import('./pages/advertisements/AdvertisementsPage'));
const NewAdvertisementPage = lazy(() => import('./pages/advertisements/NewAdvertisementPage'));
const EmergencyPage = lazy(() => import('./pages/emergency/EmergencyPage'));
const ManageFactoriesPage = lazy(() => import('./pages/admin/ManageFactoriesPage'));
const ManageInvoicesPage = lazy(() => import('./pages/admin/ManageInvoicesPage'));
const CreateInvoicePage = lazy(() => import('./pages/admin/CreateInvoicePage'));
const ApproveGatePassesPage = lazy(() => import('./pages/admin/ApproveGatePassesPage'));
const ApproveRequestsPage = lazy(() => import('./pages/admin/ApproveRequestsPage'));
const SendMessagePage = lazy(() => import('./pages/admin/SendMessagePage'));
const ManageAnnouncementsPage = lazy(() => import('./pages/admin/ManageAnnouncementsPage'));
const ApproveAdvertisementsPage = lazy(() => import('./pages/admin/ApproveAdvertisementsPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const GuardGatePassesPage = lazy(() => import('./pages/guard/GuardGatePassesPage'));
const VerifyGatePassPage = lazy(() => import('./pages/guard/VerifyGatePassPage'));
const GuardEmergencyPage = lazy(() => import('./pages/guard/GuardEmergencyPage'));
const ManageParksPage = lazy(() => import('./pages/superadmin/ManageParksPage'));
const ManageUsersPage = lazy(() => import('./pages/superadmin/ManageUsersPage'));
const SuperAdminAdsPage = lazy(() => import('./pages/superadmin/SuperAdminAdsPage'));
const SmsConfigPage = lazy(() => import('./pages/superadmin/SmsConfigPage'));

const queryClient = new QueryClient({ 
  defaultOptions: { 
    queries: { retry: 1, refetchOnWindowFocus: false } 
  } 
});

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  return loading ? <LoadingScreen /> : user ? children : <Navigate to="/login" replace />;
};

const RoleRoute = ({ roles, children }) => {
  const { user } = useAuth();
  return roles.includes(user?.role) ? children : <Navigate to="/dashboard" replace />;
};

const AdminHostRoute = ({ children }) => {
  const { user } = useAuth();
  const isAdminHost = typeof window !== 'undefined' && window.location.hostname.startsWith('admin.');
  return !isAdminHost || user?.role === 'SUPER_ADMIN' ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <AdminHostRoute>
            <DashboardLayout />
          </AdminHostRoute>
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="about" element={<AboutPage />} />
        
        <Route path="gate-passes" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD']}>
            <GatePassesPage />
          </RoleRoute>
        } />
        
        <Route path="invoices" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL']}>
            <InvoicesPage />
          </RoleRoute>
        } />
        <Route path="invoices/pay/:id" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER']}>
            <InvoicePaymentPage />
          </RoleRoute>
        } />
        
        <Route path="messages" element={<MessagesPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/new/:type" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER']}>
            <NewRequestPage />
          </RoleRoute>
        } />
        
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="advertisements" element={<AdvertisementsPage />} />
        <Route path="advertisements/new" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER']}>
            <NewAdvertisementPage />
          </RoleRoute>
        } />
        <Route path="emergency" element={<EmergencyPage />} />
        
        {/* Admin Routes */}
        <Route path="admin/factories" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <ManageFactoriesPage />
          </RoleRoute>
        } />
        <Route path="admin/invoices" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <ManageInvoicesPage />
          </RoleRoute>
        } />
        <Route path="admin/invoices/create" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <CreateInvoicePage />
          </RoleRoute>
        } />
        <Route path="admin/gate-passes" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <ApproveGatePassesPage />
          </RoleRoute>
        } />
        <Route path="admin/requests" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <ApproveRequestsPage />
          </RoleRoute>
        } />
        <Route path="admin/messages" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <SendMessagePage />
          </RoleRoute>
        } />
        <Route path="admin/announcements" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <ManageAnnouncementsPage />
          </RoleRoute>
        } />
        <Route path="admin/advertisements" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER']}>
            <ApproveAdvertisementsPage />
          </RoleRoute>
        } />
        <Route path="admin/reports" element={
          <RoleRoute roles={['SUPER_ADMIN', 'PARK_MANAGER', 'GOVERNMENT_OFFICIAL']}>
            <ReportsPage />
          </RoleRoute>
        } />
        
        {/* Guard Routes */}
        <Route path="guard/gate-passes" element={
          <RoleRoute roles={['SUPER_ADMIN', 'SECURITY_GUARD']}>
            <GuardGatePassesPage />
          </RoleRoute>
        } />
        <Route path="guard/gate-passes/:id/verify" element={
          <RoleRoute roles={['SUPER_ADMIN', 'SECURITY_GUARD']}>
            <VerifyGatePassPage />
          </RoleRoute>
        } />
        <Route path="guard/emergency" element={
          <RoleRoute roles={['SUPER_ADMIN', 'SECURITY_GUARD']}>
            <GuardEmergencyPage />
          </RoleRoute>
        } />
        
        {/* SuperAdmin Routes */}
        <Route path="superadmin/parks" element={
          <RoleRoute roles={['SUPER_ADMIN']}>
            <ManageParksPage />
          </RoleRoute>
        } />
        <Route path="superadmin/users" element={
          <RoleRoute roles={['SUPER_ADMIN']}>
            <ManageUsersPage />
          </RoleRoute>
        } />
        <Route path="superadmin/advertisements" element={
          <RoleRoute roles={['SUPER_ADMIN']}>
            <SuperAdminAdsPage />
          </RoleRoute>
        } />
        <Route path="superadmin/sms-config" element={
          <RoleRoute roles={['SUPER_ADMIN']}>
            <SmsConfigPage />
          </RoleRoute>
        } />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <OfflineBanner />
        <Router>
          <AuthProvider>
            <Suspense fallback={<LoadingScreen />}>
              <AppRoutes />
            </Suspense>
          </AuthProvider>
        </Router>
        <InstallPrompt />
      </NotificationProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
