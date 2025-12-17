import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AuthProvider } from './providers/AuthProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { ThemeProvider as CustomThemeProvider } from './providers/ThemeProvider';
import { LoadingScreen } from './components/common/LoadingScreen';
import { RTL } from './components/common/RTL';

// Lazy load pages for better performance
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const FactoryListPage = lazy(() => import('./pages/factories/FactoryListPage'));
const FactoryDetailPage = lazy(() => import('./pages/factories/FactoryDetailPage'));
const GatePassListPage = lazy(() => import('./pages/gate-passes/GatePassListPage'));
const GatePassCreatePage = lazy(() => import('./pages/gate-passes/GatePassCreatePage'));
const InvoiceListPage = lazy(() => import('./pages/invoices/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('./pages/invoices/InvoiceDetailPage'));
const RequestListPage = lazy(() => import('./pages/requests/RequestListPage'));
const RequestCreatePage = lazy(() => import('./pages/requests/RequestCreatePage'));
const AnnouncementListPage = lazy(() => import('./pages/announcements/AnnouncementListPage'));
const AdvertisementListPage = lazy(() => import('./pages/advertisements/AdvertisementListPage'));
const EmergencyListPage = lazy(() => import('./pages/emergency/EmergencyListPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <ThemeProvider theme={CustomThemeProvider.useTheme()}>
          <CssBaseline />
          <RTL>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <AuthProvider>
                <NotificationProvider>
                  <Router>
                    <Suspense fallback={<LoadingScreen />}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                        <Routes>
                          {/* Public Routes */}
                          <Route path="/login" element={<LoginPage />} />
                          <Route path="/register" element={<RegisterPage />} />
                          
                          {/* Protected Routes */}
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<DashboardPage />} />
                          
                          {/* Factory Management */}
                          <Route path="/factories" element={<FactoryListPage />} />
                          <Route path="/factories/:id" element={<FactoryDetailPage />} />
                          
                          {/* Gate Pass System */}
                          <Route path="/gate-passes" element={<GatePassListPage />} />
                          <Route path="/gate-passes/create" element={<GatePassCreatePage />} />
                          
                          {/* Invoice System */}
                          <Route path="/invoices" element={<InvoiceListPage />} />
                          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                          
                          {/* Request System */}
                          <Route path="/requests" element={<RequestListPage />} />
                          <Route path="/requests/create" element={<RequestCreatePage />} />
                          
                          {/* Communication */}
                          <Route path="/announcements" element={<AnnouncementListPage />} />
                          <Route path="/advertisements" element={<AdvertisementListPage />} />
                          <Route path="/emergency" element={<EmergencyListPage />} />
                          
                          {/* Analytics */}
                          <Route path="/analytics" element={<AnalyticsPage />} />
                          
                          {/* User Management */}
                          <Route path="/profile" element={<ProfilePage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                          
                          {/* Catch all */}
                          <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </Box>
                    </Suspense>
                  </Router>
                </NotificationProvider>
              </AuthProvider>
            </LocalizationProvider>
          </RTL>
        </ThemeProvider>
      </CustomThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;