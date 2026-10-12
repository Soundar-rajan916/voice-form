import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { UserHome } from './pages/UserHome';
import { VoiceChat } from './pages/VoiceChat';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy-load staff routes for bundle optimization
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const FormBuilder = lazy(() =>
  import('./pages/FormBuilder').then((m) => ({ default: m.FormBuilder }))
);
const Submissions = lazy(() =>
  import('./pages/Submissions').then((m) => ({ default: m.Submissions }))
);
const NotFound = lazy(() => import('./pages/NotFound'));

const ProtectedRoute = ({ children, requireRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDEDE9] flex flex-col items-center justify-center text-[#23272F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF] mb-3" />
        <p className="text-xs font-sans-ui">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(user.role)) {
      if (user.role === 'admin') return <Navigate to="/admin" replace />;
      return <Navigate to="/user" replace />;
    }
  }

  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDEDE9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/user" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#EDEDE9] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#1F3FBF]" />
            </div>
          }
        >
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />



              {/* Admin (Staff) Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/builder/new"
                element={
                  <ProtectedRoute requireRole="admin">
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/builder/:id"
                element={
                  <ProtectedRoute requireRole="admin">
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/forms/:formId/submissions"
                element={
                  <ProtectedRoute requireRole="admin">
                    <Submissions />
                  </ProtectedRoute>
                }
              />


              {/* User (Citizen) Routes */}
              <Route
                path="/user"
                element={
                  <ProtectedRoute requireRole="user">
                    <UserHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fill/:submissionId"
                element={
                  <ProtectedRoute requireRole="user">
                    <VoiceChat />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
