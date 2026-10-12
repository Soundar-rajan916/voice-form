// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { act } from 'react';
import * as AuthContextModule from '../context/AuthContext';
import { VoiceChat } from '../pages/VoiceChat';

// Mock Web Audio and WebSocket
window.HTMLElement.prototype.scrollIntoView = vi.fn();

class MockWebSocket {
  constructor() {
    this.send = vi.fn();
    this.close = vi.fn();
    this.readyState = 1;
    this.onopen = null;
    this.onmessage = null;
    MockWebSocket.lastInstance = this;
  }
}
MockWebSocket.lastInstance = null;
global.WebSocket = MockWebSocket;

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
        <Routes>
          <Route path="/fill/:submissionId" element={<VoiceChat />} />
        </Routes>
      </MemoryRouter>
    );

    // Form page title or container should be rendered
    expect(screen.getByText('Application Form')).toBeDefined();
    expect(screen.getByLabelText(/Main Navigation/i)).toBeDefined();
  });

  it('restores previous conversation history and questions when reopening a submitted form', async () => {

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 10, username: 'testcitizen', role: 'user' },
      token: 'mock-token',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/fill/149']}>
        <Routes>
          <Route path="/fill/:submissionId" element={<VoiceChat />} />
        </Routes>
      </MemoryRouter>
    );

    // Simulate server 'ready' payload for a submitted form with existing answers
    const mockReadyPayload = {
      type: 'ready',
      submission_id: 149,
      submission_status: 'submitted',
      form_title: 'Old Age Pension Form',
      fields: [
        { id: 1, field_name: 'full_name', question_en: 'What is your full name?', position: 0 },
        { id: 2, field_name: 'age', question_en: 'What is your age in completed years?', position: 1 },
      ],
      answers: {
        1: { value: 'Soundararajan', raw_transcript: 'Soundararajan', source: 'voice', language: 'en' },
        2: { value: '65', raw_transcript: '65', source: 'voice', language: 'en' },
      },
    };

    // Trigger onmessage with ready event
    const wsInstance = MockWebSocket.lastInstance;
    expect(wsInstance).not.toBeNull();
    act(() => {
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage({ data: JSON.stringify(mockReadyPayload) });
      }
    });

    // Verify reconstructed conversation messages
    expect(await screen.findByText('What is your full name?')).toBeDefined();
    const answers1 = await screen.findAllByText('Soundararajan');
    expect(answers1.length).toBeGreaterThan(0);
    expect(await screen.findByText('What is your age in completed years?')).toBeDefined();
    const answers2 = await screen.findAllByText('65');
    expect(answers2.length).toBeGreaterThan(0);
    const lockMsgs = await screen.findAllByText(/This application has been completed and is locked/i);
    expect(lockMsgs.length).toBeGreaterThan(0);
  });
});
