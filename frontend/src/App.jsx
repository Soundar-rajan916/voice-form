import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { FormBuilder } from './pages/FormBuilder';
import { Submissions } from './pages/Submissions';
import { UserHome } from './pages/UserHome';
import { VoiceChat } from './pages/VoiceChat';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requireRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-xs">Authenticating session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />;
  }

  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
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

          {/* User Routes */}
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fill/:submissionId"
            element={
              <ProtectedRoute>
                <VoiceChat />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
