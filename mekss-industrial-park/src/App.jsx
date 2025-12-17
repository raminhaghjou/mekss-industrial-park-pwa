import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { ThemeProvider as CustomThemeProvider } from './providers/ThemeProvider';
import { LoadingScreen } from './components/common/LoadingScreen';
import { RTL } from './components/common/RTL';
import { DashboardLayout } from './layouts/DashboardLayout';

// Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
// Factory Manager
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
// Park Manager
const ManageFactoriesPage = lazy(() => import('./pages/admin/ManageFactoriesPage'));
const ManageInvoicesPage = lazy(() => import('./pages/admin/ManageInvoicesPage'));
const CreateInvoicePage = lazy(() => import('./pages/admin/CreateInvoicePage'));
const ApproveGatePassesPage = lazy(() => import('./pages/admin/ApproveGatePassesPage'));
const ApproveRequestsPage = lazy(() => import('./pages/admin/ApproveRequestsPage'));
const SendMessagePage = lazy(() => import('./pages/admin/SendMessagePage'));
const ManageAnnouncementsPage = lazy(() => import('./pages/admin/ManageAnnouncementsPage'));
const ApproveAdvertisementsPage = lazy(() => import('./pages/admin/ApproveAdvertisementsPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
// Guard
const GuardGatePassesPage = lazy(() => import('./pages/guard/GuardGatePassesPage'));
const VerifyGatePassPage = lazy(() => import('./pages/guard/VerifyGatePassPage'));
const GuardEmergencyPage = lazy(() => import('./pages/guard/GuardEmergencyPage'));
// Super Admin
const ManageParksPage = lazy(() => import('./pages/superadmin/ManageParksPage'));
const ManageUsersPage = lazy(() => import('./pages/superadmin/ManageUsersPage'));
const SuperAdminAdsPage = lazy(() => import('./pages/superadmin/SuperAdminAdsPage'));
const SmsConfigPage = lazy(() => import('./pages/superadmin/SmsConfigPage'));


const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* General */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="about" element={<AboutPage />} />

        {/* Factory Manager */}
        <Route path="gate-passes" element={<GatePassesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/pay/:id" element={<InvoicePaymentPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/new/:type" element={<NewRequestPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="advertisements" element={<AdvertisementsPage />} />
        <Route path="advertisements/new" element={<NewAdvertisementPage />} />
        <Route path="emergency" element={<EmergencyPage />} />

        {/* Park Manager */}
        <Route path="admin/factories" element={<ManageFactoriesPage />} />
        <Route path="admin/invoices" element={<ManageInvoicesPage />} />
        <Route path="admin/invoices/create" element={<CreateInvoicePage />} />
        <Route path="admin/gate-passes" element={<ApproveGatePassesPage />} />
        <Route path="admin/requests" element={<ApproveRequestsPage />} />
        <Route path="admin/messages" element={<SendMessagePage />} />
        <Route path="admin/announcements" element={<ManageAnnouncementsPage />} />
        <Route path="admin/advertisements" element={<ApproveAdvertisementsPage />} />
        <Route path="admin/reports" element={<ReportsPage />} />

        {/* Security Guard */}
        <Route path="guard/gate-passes" element={<GuardGatePassesPage />} />
        <Route path="guard/gate-passes/:id/verify" element={<VerifyGatePassPage />} />
        <Route path="guard/emergency" element={<GuardEmergencyPage />} />

        {/* Super Admin */}
        <Route path="superadmin/parks" element={<ManageParksPage />} />
        <Route path="superadmin/users" element={<ManageUsersPage />} />
        <Route path="superadmin/advertisements" element={<SuperAdminAdsPage />} />
        <Route path="superadmin/sms-config" element={<SmsConfigPage />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <ThemeProvider theme={CustomThemeProvider.useTheme()}>
          <CssBaseline />
          <RTL>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Router>
                <AuthProvider>
                  <NotificationProvider>
                    <Suspense fallback={<LoadingScreen />}>
                      <AppRoutes />
                    </Suspense>
                  </NotificationProvider>
                </AuthProvider>
              </Router>
            </LocalizationProvider>
          </RTL>
        </ThemeProvider>
      </CustomThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
