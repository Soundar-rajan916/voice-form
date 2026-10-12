// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../context/AuthContext';
import { VoiceChat } from '../pages/VoiceChat';

// Mock Web Audio and WebSocket
window.HTMLElement.prototype.scrollIntoView = vi.fn();

global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  readyState: 0,
}));

vi.mock('../hooks/useVad', () => ({
  useVad: () => ({
    vadState: 'idle',
    isListening: false,
    permissionState: 'granted',
    startListening: vi.fn(),
    stopListening: vi.fn(),
    toggleListening: vi.fn(),
  }),
}));

vi.mock('../hooks/useSpeech', () => ({
  useSpeech: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    isSpeaking: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VoiceChat Page Mount', () => {
  it('mounts VoiceChat page without reference errors or render crashes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 10, username: 'testcitizen', role: 'user' },
      token: 'mock-token',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/fill/149']}>
        <VoiceChat />
      </MemoryRouter>
    );

    // Form page title or container should be rendered
    expect(screen.getByText('Application Form')).toBeDefined();
    expect(screen.getByLabelText(/Main Navigation/i)).toBeDefined();
  });
});
