// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as AuthContextModule from '../context/AuthContext';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Replicate ProtectedRoute logic as in App.jsx
const ProtectedRoute = ({ children, requireRole }) => {
  const { user, loading } = AuthContextModule.useAuth();

  if (loading) {
    return <div>Verifying session...</div>;
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

describe('Role-Based Route Protection', () => {
  it('redirects admin away from user portal (/user) to /admin', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/user']}>
        <Routes>
          <Route
            path="/user"
            element={
              <ProtectedRoute requireRole="user">
                <div>User Portal Page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<div>Admin Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('User Portal Page')).toBeNull();
    expect(screen.getByText('Admin Dashboard Page')).toBeDefined();
  });

  it('redirects admin away from form fill portal (/fill/:submissionId) to /admin', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/fill/42']}>
        <Routes>
          <Route
            path="/fill/:submissionId"
            element={
              <ProtectedRoute requireRole="user">
                <div>Voice Chat Fill Portal</div>
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<div>Admin Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Voice Chat Fill Portal')).toBeNull();
    expect(screen.getByText('Admin Dashboard Page')).toBeDefined();
  });

  it('allows citizen (user) to access user portal (/user)', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 2, username: 'citizen', role: 'user' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/user']}>
        <Routes>
          <Route
            path="/user"
            element={
              <ProtectedRoute requireRole="user">
                <div>User Portal Page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<div>Admin Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('User Portal Page')).toBeDefined();
    expect(screen.queryByText('Admin Dashboard Page')).toBeNull();
  });

  it('redirects citizen (user) away from admin portal to /user', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 2, username: 'citizen', role: 'user' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireRole="admin">
                <div>Admin Dashboard Page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/user" element={<div>User Portal Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin Dashboard Page')).toBeNull();
    expect(screen.getByText('User Portal Page')).toBeDefined();
  });
});
