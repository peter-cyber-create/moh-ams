import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AmsShell from './components/AmsShell';
import { AuthProvider, RequireAuth } from './lib/AuthContext';
import AccountabilityCasePage from './pages/AccountabilityCasePage';
import AccountabilityListPage from './pages/AccountabilityListPage';
import ActivitiesListPage from './pages/ActivitiesListPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import AdminPage from './pages/AdminPage';
import AdminAccessPage from './pages/AdminAccessPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserCreatePage from './pages/AdminUserCreatePage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import CompliancePage from './pages/CompliancePage';
import CompliancePersonPage from './pages/CompliancePersonPage';
import EditActivityPage from './pages/EditActivityPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HelpPage from './pages/HelpPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MorePage from './pages/MorePage';
import PersonPage from './pages/PersonPage';
import RegisterActivityPage from './pages/RegisterActivityPage';
import RegisterMultipleActivitiesPage from './pages/RegisterMultipleActivitiesPage';
import ReportsHubPage, { ReportViewPage } from './pages/ReportsHubPage';
import SystemPage from './pages/SystemPage';
import TemplatesPage from './pages/TemplatesPage';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AmsShell />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="activities" element={<ActivitiesListPage />} />
            <Route path="activities/register" element={<RegisterActivityPage />} />
            <Route path="activities/register-multiple" element={<RegisterMultipleActivitiesPage />} />
            <Route path="activities/templates" element={<TemplatesPage />} />
            <Route path="activities/:id/edit" element={<EditActivityPage />} />
            <Route path="activities/:id" element={<ActivityDetailPage />} />
            <Route path="accountability" element={<AccountabilityListPage />} />
            <Route path="accountability/:id" element={<AccountabilityCasePage />} />
            <Route path="reports" element={<ReportsHubPage />} />
            <Route path="reports/:reportId" element={<ReportViewPage />} />
            <Route path="compliance" element={<CompliancePage />} />
            <Route path="compliance/participants/:identityKey" element={<CompliancePersonPage />} />
            <Route path="persons/:id" element={<PersonPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/access" element={<AdminAccessPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/users/new" element={<AdminUserCreatePage />} />
            <Route path="admin/users/:id" element={<AdminUserDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/password" element={<ChangePasswordPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
