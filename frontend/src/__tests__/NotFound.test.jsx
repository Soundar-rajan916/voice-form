// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { NotFound } from '../pages/NotFound';

afterEach(() => {
  cleanup();
});

describe('NotFound 404 Page', () => {
  it('renders 404 status, badge, and descriptive copy', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/non-existent-page']}>
          <NotFound />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getAllByText('404').length).toBeGreaterThan(0);
    expect(screen.getByText('Page Not Found')).toBeDefined();
    expect(screen.getByText(/This page does not exist or has been moved/i)).toBeDefined();
    expect(screen.getByText('Back to Home')).toBeDefined();
    expect(screen.getByText('Go Back')).toBeDefined();
  });

  it('switches between English and Tamil translations dynamically', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/non-existent-page']}>
          <NotFound />
        </MemoryRouter>
      </AuthProvider>
    );

    const tamilBtn = screen.getByRole('button', { name: 'தமிழ்' });
    fireEvent.click(tamilBtn);

    expect(screen.getByText('பக்கம் காணப்படவில்லை')).toBeDefined();
    expect(screen.getByText(/நீங்கள் தேடும் பக்கம் கிடைக்கவில்லை/i)).toBeDefined();
    expect(screen.getByText('முகப்புக்குச் செல்க')).toBeDefined();
    expect(screen.getByText('முந்தைய பக்கம்')).toBeDefined();

    const englishBtn = screen.getByRole('button', { name: 'English' });
    fireEvent.click(englishBtn);

    expect(screen.getByText('Page Not Found')).toBeDefined();
    expect(screen.getByText('Back to Home')).toBeDefined();
  });
});
