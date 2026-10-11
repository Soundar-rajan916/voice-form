import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Volume2, VolumeX, AlertCircle, RefreshCw,
  HelpCircle, CheckCircle, Printer, ArrowLeft, ArrowRight,
  Shield, Keyboard, Camera, Check, FileText
} from 'lucide-react';
import TamilVirtualKeyboard from '../components/TamilVirtualKeyboard';
import CameraCaptureModal from '../components/CameraCaptureModal';
import ReceiptSlipPrint from '../components/ReceiptSlipPrint';
import ApplicationA4Print from '../components/ApplicationA4Print';
import { brandConfig } from '../brand';

const KIOSK_STEPS = {
  LANGUAGE: 1,
  SERVICE: 2,
  PRIVACY: 3,
  VOICE_FILL: 4,
  REVIEW: 5,
  RECEIPT: 6,
};

export default function KioskMode() {
  const navigate = useNavigate();

  // Kiosk Session State
  const [step, setStep] = useState(KIOSK_STEPS.LANGUAGE);
  const [selectedLang, setSelectedLang] = useState('ta'); // 'ta' or 'en'
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [kioskSession, setKioskSession] = useState(null); // { submission_id, scoped_token }
  const [submissionData, setSubmissionData] = useState(null);

  // Kiosk Device Configuration
  const [voiceMode] = useState('auto'); // 'auto' or 'push_to_talk'
  const [idleTimeoutSeconds] = useState(60);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [ttsMissingTamil, setTtsMissingTamil] = useState(false);

  // Idle Timer & Countdown Modal
  const [idleModalVisible, setIdleModalVisible] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(15);
  const idleTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Form State
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [activeQuestionText, setActiveQuestionText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isHoldingToSpeak, setIsHoldingToSpeak] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [typedInputText, setTypedInputText] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [helpAlertVisible, setHelpAlertVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printType, setPrintType] = useState('slip'); // 'slip' or 'a4'

  // WebSocket & Media
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Check TTS Voice on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const checkVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const hasTamil = voices.some((v) => v.lang.startsWith('ta') || (v.name && v.name.toLowerCase().includes('tamil')));
        setTtsMissingTamil(!hasTamil);
      };
      checkVoices();
      window.speechSynthesis.onvoiceschanged = checkVoices;
    }
  }, []);

  // Fetch Published Services on mount
  useEffect(() => {
    fetch('/kiosk/forms')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setServices(data))
      .catch((err) => console.error('[Kiosk] Fetch services error:', err));
  }, []);

  // Reset & Wipe All Kiosk Data
  const wipeSessionAndReset = useCallback(async () => {
    // 1. Clear React State
    setStep(KIOSK_STEPS.LANGUAGE);
    setSelectedLang('ta');
    setSelectedService(null);
    setKioskSession(null);
    setSubmissionData(null);
    setAnswers({});
    setCurrentFieldIndex(0);
    setTypedInputText('');
    setShowKeyboard(false);
    setShowCamera(false);
    setHelpAlertVisible(false);
    setIsListening(false);
    setIsHoldingToSpeak(false);
    setIdleModalVisible(false);

    // 2. Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Kiosk reset');
      } catch (e) {}
      wsRef.current = null;
    }

    // 3. Stop Media Streams & Audio
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 4. Clear browser storage & history replacement
    sessionStorage.clear();
    try {
      window.history.replaceState(null, '', '/kiosk');
    } catch (e) {}

    // Reset idle timers
    resetIdleTimer();
  }, [navigate]);

  // Idle Timer Management
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setIdleModalVisible(false);
    setIdleCountdown(15);

    // Only run idle reset during active citizen interaction (steps 2 to 6)
    if (step >= KIOSK_STEPS.SERVICE) {
      idleTimerRef.current = setTimeout(() => {
        setIdleModalVisible(true);
        let sec = 15;
        countdownIntervalRef.current = setInterval(() => {
          sec -= 1;
          setIdleCountdown(sec);
          if (sec <= 0) {
            clearInterval(countdownIntervalRef.current);
            wipeSessionAndReset();
          }
        }, 1000);
      }, idleTimeoutSeconds * 1000);
    }
  }, [step, idleTimeoutSeconds, wipeSessionAndReset]);

  // Reset idle timer on any user touch/click/keypress
  useEffect(() => {
    const handleActivity = () => {
      if (!idleModalVisible) {
        resetIdleTimer();
      }
    };
    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [idleModalVisible, resetIdleTimer]);

  // Read question text aloud using TTS
  const speakQuestion = useCallback((text, langCode = 'ta') => {
    if (!isAudioEnabled || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode === 'ta' ? 'ta-IN' : 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[TTS] Speech synthesis error:', err);
    }
  }, [isAudioEnabled]);

  // Start Form Session on Consent Agreement
  const handleConsentAgree = async () => {
    if (!selectedService) return;
    try {
      const res = await fetch('/kiosk/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: selectedService.id,
          language: selectedLang,
          consent_agreed: true
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || 'Could not start session.');
        return;
      }
      const data = await res.json();
      setKioskSession(data);

      // Fetch initial submission detail
      const subRes = await fetch(`/submissions/${data.submission_id}`, {
        headers: { Authorization: `Bearer ${data.scoped_token}` }
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubmissionData(subData);
        setStep(KIOSK_STEPS.VOICE_FILL);
        connectWebSocket(data.submission_id, data.scoped_token);
      }
    } catch (err) {
      console.error('[Kiosk] Session creation error:', err);
    }
  };

  // Connect Scoped WebSocket
  const connectWebSocket = (subId, token) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/submissions/${subId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'ready' || msg.type === 'state_sync' || msg.type === 'navigate' || msg.type === 'answer') {
          if (msg.fields && msg.current_field_index !== undefined) {
            setCurrentFieldIndex(msg.current_field_index);
            const currentF = msg.fields[msg.current_field_index];
            if (currentF) {
              const qText = selectedLang === 'ta' && currentF.question_ta ? currentF.question_ta : (currentF.question_en || currentF.field_name);
              setActiveQuestionText(qText);
              speakQuestion(qText, selectedLang);
            }
          }
          if (msg.answers) {
            const map = {};
            Object.values(msg.answers).forEach((a) => {
              map[a.field_id] = a.value;
            });
            setAnswers(map);
          }
          if (msg.is_complete) {
            setStep(KIOSK_STEPS.REVIEW);
          }
        }
      } catch (err) {
        console.error('[Kiosk WS] Parse error:', err);
      }
    };

    ws.onerror = (e) => console.error('[Kiosk WS] Error:', e);
  };

  // Call Staff
  const handleCallStaff = async () => {
    try {
      await fetch('/kiosk/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_name: 'Self-Service Kiosk #01' })
      });
      setHelpAlertVisible(true);
      setTimeout(() => setHelpAlertVisible(false), 8000);
    } catch (err) {
      console.error('[Kiosk Help] Error:', err);
    }
  };

  // Submit Application
  const handleSubmitApplication = async () => {
    if (!kioskSession) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/submissions/${kioskSession.submission_id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${kioskSession.scoped_token}`
        }
      });
      if (res.ok) {
        const updated = await res.json();
        setSubmissionData(updated);
        setStep(KIOSK_STEPS.RECEIPT);
      } else {
        const err = await res.json();
        alert(err.detail || 'Submit failed. Missing required fields.');
      }
    } catch (err) {
      console.error('[Kiosk Submit] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Handling (window.print with kiosk print increment)
  const handlePrint = async (type = 'slip') => {
    setPrintType(type);
    if (kioskSession) {
      try {
        await fetch(`/submissions/${kioskSession.submission_id}/print?print_type=${type}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kioskSession.scoped_token}` }
        });
      } catch (e) {}
    }
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Keyboard Answer Submit
  const handleVirtualKeyboardDone = () => {
    if (!typedInputText.trim() || !wsRef.current) return;
    const currentField = submissionData?.fields?.[currentFieldIndex];
    if (currentField) {
      wsRef.current.send(
        JSON.stringify({
          type: 'text_input',
          field_id: currentField.id,
          text: typedInputText.trim()
        })
      );
    }
    setTypedInputText('');
    setShowKeyboard(false);
  };

  const fields = submissionData?.fields || [];
  const activeField = fields[currentFieldIndex];
  const answeredCount = Object.keys(answers).length;
  const totalCount = fields.length;

  return (
    <div className="kiosk-mode min-h-screen bg-[#D6CCC2] text-[#23272F] flex flex-col justify-between select-none">
      {/* Kiosk Sticky Persistent Top Bar */}
      <header className="bg-[#F5EBE0] border-b-2 border-[#23272F] px-4 py-3 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#5B2A86] flex items-center justify-center text-white font-bold text-xl">
            CD
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif-printed leading-tight">
              {selectedLang === 'ta' ? brandConfig.appNameTa : brandConfig.appName}
            </h1>
            <p className="text-xs text-[#23272F]/70">
              {selectedLang === 'ta' ? brandConfig.disclaimerTa : brandConfig.disclaimerEn}
            </p>
          </div>
        </div>

        {/* Persistent Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCallStaff}
            className="touch-target-64 px-4 py-2 bg-[#F5EBE0] text-[#5B2A86] border-2 border-[#5B2A86] rounded-md font-bold flex items-center gap-2 hover:bg-[#D5BDAF]/40 active:scale-95 transition"
            aria-label="Call staff for help"
          >
            <HelpCircle className="w-6 h-6 text-[#5B2A86]" />
            <span className="hidden sm:inline">
              {selectedLang === 'ta' ? 'அலுவலர் உதவி' : 'Get Help'}
            </span>
          </button>

          <button
            type="button"
            onClick={wipeSessionAndReset}
            className="touch-target-64 px-4 py-2 bg-[#F5EBE0] text-[#B3261E] border-2 border-[#B3261E] rounded-md font-bold flex items-center gap-2 hover:bg-red-50 active:scale-95 transition"
            aria-label="Start over and wipe session"
          >
            <RefreshCw className="w-6 h-6 text-[#B3261E]" />
            <span className="hidden sm:inline">
              {selectedLang === 'ta' ? 'முதலில் இருந்து' : 'Start Over'}
            </span>
          </button>

          {/* Audio toggle */}
          <button
            type="button"
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`touch-target-64 p-2 border-2 border-[#23272F] rounded-md transition ${
              isAudioEnabled ? 'bg-[#5B2A86] text-white' : 'bg-[#F5EBE0] text-[#23272F]'
            }`}
            aria-label="Toggle question reading aloud"
          >
            {isAudioEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Staff TTS Warning Banner if Tamil voice is missing on device */}
      {ttsMissingTamil && step >= KIOSK_STEPS.SERVICE && (
        <div className="bg-[#D5BDAF] text-[#23272F] px-4 py-2 text-sm border-b border-[#23272F] flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#5B2A86]" />
            <span>
              {selectedLang === 'ta'
                ? 'தமிழ் குரல் கிடைக்கவில்லை. கேள்விகள் திரையில் காட்டப்படும்.'
                : 'Tamil voice synthesizer not found on this device. Questions displayed as text.'}
            </span>
          </div>
        </div>
      )}

      {/* Call Staff Alert Toast */}
      {helpAlertVisible && (
        <div className="fixed top-20 right-6 z-50 bg-[#5B2A86] text-white p-4 rounded-lg shadow-2xl flex items-center gap-3 border-2 border-white animate-bounce">
          <CheckCircle className="w-7 h-7 text-[#D5BDAF]" />
          <div>
            <p className="font-bold text-lg">
              {selectedLang === 'ta' ? 'அலுவலர் அழைக்கப்பட்டுள்ளார்!' : 'Help is on the way!'}
            </p>
            <p className="text-sm">
              {selectedLang === 'ta'
                ? 'ஒரு பணியாளர் விரைவில் உங்கள் உதவிக்கு வருவார்.'
                : 'A service assistant has been notified.'}
            </p>
          </div>
        </div>
      )}

      {/* MAIN STEP FLOW */}
      <main className="flex-1 flex flex-col justify-center p-4 md:p-8 max-w-6xl mx-auto w-full">
        {/* STEP 1: CHOOSE LANGUAGE */}
        {step === KIOSK_STEPS.LANGUAGE && (
          <div className="text-center space-y-8 my-auto">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold font-serif-printed text-[#23272F]">
                மொழியைத் தேர்ந்தெடுக்கவும்
              </h2>
              <p className="text-2xl text-[#23272F]/80 mt-2">Choose your preferred language</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedLang('ta');
                  setStep(KIOSK_STEPS.SERVICE);
                }}
                className="touch-target-64 h-36 bg-[#F5EBE0] border-4 border-[#5B2A86] hover:bg-[#D5BDAF] text-[#23272F] rounded-xl shadow-md p-6 flex flex-col items-center justify-center transition active:scale-95"
              >
                <span className="text-4xl font-bold font-sans-counter text-[#5B2A86]">தமிழ்</span>
                <span className="text-lg text-[#23272F]/75 mt-2">தமிழ் வழியில் தொடரவும்</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedLang('en');
                  setStep(KIOSK_STEPS.SERVICE);
                }}
                className="touch-target-64 h-36 bg-[#F5EBE0] border-4 border-[#23272F] hover:bg-[#D5BDAF] text-[#23272F] rounded-xl shadow-md p-6 flex flex-col items-center justify-center transition active:scale-95"
              >
                <span className="text-4xl font-bold text-[#23272F]">English</span>
                <span className="text-lg text-[#23272F]/75 mt-2">Continue in English</span>
              </button>
            </div>

            <p className="text-sm text-[#23272F]/70 italic max-w-md mx-auto">
              {brandConfig.disclaimerEn}
            </p>
          </div>
        )}

        {/* STEP 2: CHOOSE SERVICE */}
        {step === KIOSK_STEPS.SERVICE && (
          <div className="space-y-6 my-auto">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold font-serif-printed text-[#23272F]">
                {selectedLang === 'ta' ? 'சேவையைத் தேர்ந்தெடுக்கவும்' : 'Choose a service'}
              </h2>
              <p className="text-lg text-[#23272F]/80 mt-1">
                {selectedLang === 'ta' ? 'விண்ணப்பிக்க வேண்டிய படிவத்தைத் தொடுங்கள்' : 'Touch the service you wish to apply for'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => {
                    setSelectedService(srv);
                    setStep(KIOSK_STEPS.PRIVACY);
                  }}
                  className="touch-target-64 min-h-[160px] bg-[#F5EBE0] border-3 border-[#23272F] hover:border-[#5B2A86] hover:bg-[#D5BDAF]/30 rounded-xl p-6 text-left flex flex-col justify-between shadow-sm active:scale-95 transition"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-[#1F3FBF] leading-snug">{srv.title}</h3>
                    <p className="text-sm text-[#23272F]/80 mt-2 line-clamp-3">{srv.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase text-[#5B2A86]">
                    <span>{srv.field_count} {selectedLang === 'ta' ? 'கேள்விகள்' : 'Questions'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </button>
              ))}
            </div>

            {services.length === 0 && (
              <p className="text-center text-lg text-[#23272F]/70">
                {selectedLang === 'ta' ? 'தற்போது சேவைகள் எதுவும் இல்லை.' : 'No published services available.'}
              </p>
            )}
          </div>
        )}

        {/* STEP 3: PRIVACY NOTICE AND CONSENT */}
        {step === KIOSK_STEPS.PRIVACY && (
          <div className="max-w-2xl mx-auto bg-[#F5EBE0] border-3 border-[#23272F] rounded-xl p-6 md:p-8 space-y-6 my-auto shadow-md">
            <div className="flex items-center gap-3 border-b-2 border-[#23272F] pb-4">
              <Shield className="w-10 h-10 text-[#5B2A86]" />
              <div>
                <h2 className="text-2xl md:text-3xl font-bold font-serif-printed">
                  {selectedLang === 'ta' ? 'தனியுரிமை மற்றும் ஒப்புதல்' : 'Privacy Notice & Consent'}
                </h2>
                <p className="text-sm text-[#23272F]/70">{selectedService?.title}</p>
              </div>
            </div>

            <div className="text-lg md:text-xl text-[#23272F] space-y-4 leading-relaxed font-sans-counter">
              <p>
                {selectedLang === 'ta'
                  ? 'உங்கள் குரல் உரை வடிவமாக மாற்ற எங்கள் குரல் சேவைக்கு அனுப்பப்படுகிறது. ஆடியோ சேமிக்கப்படாது.'
                  : 'Your voice is sent to our speech provider to be turned into text. The audio itself is never stored.'}
              </p>
              <p>
                {selectedLang === 'ta'
                  ? 'ஆவணங்கள் மற்றும் புகைப்படங்கள் இந்த படிவத்தை நிரப்ப மட்டுமே பயன்படுத்தப்பட்டு உடனடியாக நீக்கப்படும்.'
                  : 'Documents and photos are read to fill this form and are deleted right after extraction.'}
              </p>
              <p className="text-base text-[#1F3FBF] font-semibold">
                {selectedLang === 'ta'
                  ? 'உங்கள் விண்ணப்பம் 30 நாட்களுக்கு மட்டுமே இந்த மையத்தில் வைக்கப்படும்.'
                  : 'Your application record is kept for 30 days.'}
              </p>
            </div>

            <div className="pt-4 border-t border-[#23272F]/30 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setStep(KIOSK_STEPS.SERVICE)}
                className="touch-target-64 px-6 py-4 bg-[#D6CCC2] text-[#23272F] font-bold text-lg rounded-lg border-2 border-[#23272F] hover:bg-gray-300 transition"
              >
                {selectedLang === 'ta' ? 'பின்செல்' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleConsentAgree}
                className="touch-target-64 flex-1 py-4 bg-[#5B2A86] text-white font-bold text-xl rounded-lg border-2 border-[#5B2A86] hover:opacity-90 active:scale-95 transition shadow-lg flex items-center justify-center gap-3"
              >
                <Check className="w-7 h-7" />
                <span>
                  {selectedLang === 'ta' ? 'நான் ஒப்புக்கொண்டு தொடர்கிறேன்' : 'I Agree and Continue'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FILL BY VOICE (Landscape: conversation left, Sheet right; Portrait: question top, Sheet below) */}
        {step === KIOSK_STEPS.VOICE_FILL && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 my-auto">
            {/* Left / Top: Active Question & Input Controls */}
            <div className="lg:w-1/2 flex flex-col justify-between bg-[#F5EBE0] border-2 border-[#23272F] rounded-lg p-6 shadow-sm">
              <div>
                {/* Progress line */}
                <div className="mb-4">
                  <div className="flex justify-between text-base font-bold text-[#23272F]/80 mb-1">
                    <span>
                      {selectedLang === 'ta'
                        ? `${totalCount} இல் ${answeredCount} பதிலளிக்கப்பட்டது`
                        : `${answeredCount} of ${totalCount} answered`}
                    </span>
                    <span>{Math.round((answeredCount / Math.max(1, totalCount)) * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#D6CCC2] h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-[#5B2A86] h-full transition-all duration-300"
                      style={{ width: `${(answeredCount / Math.max(1, totalCount)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Active Question Title */}
                <div className="bg-[#D5BDAF]/30 border-l-4 border-[#5B2A86] p-4 rounded mb-4">
                  <span className="text-xs uppercase font-mono text-[#5B2A86] block mb-1">
                    {selectedLang === 'ta' ? 'கேள்வி' : 'Current Question'} #{currentFieldIndex + 1}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold font-serif-printed text-[#23272F] leading-tight">
                    {activeQuestionText || (activeField ? activeField.question_en : 'Please speak your answer')}
                  </h3>
                </div>

                {/* Sensitive field warning */}
                {activeField?.is_sensitive_number && (
                  <div className="bg-amber-100 border border-amber-400 text-amber-900 px-4 py-2 rounded text-sm mb-4">
                    <strong>{selectedLang === 'ta' ? 'பாதுகாக்கப்பட்ட எண்:' : 'Sensitive Number:'}</strong>{' '}
                    {selectedLang === 'ta'
                      ? 'தனியுரிமைக்காக விசைப்பலகை மூலம் தட்டச்சு மட்டுமே செய்ய வேண்டும்.'
                      : 'Must be typed via on-screen keyboard for privacy.'}
                  </div>
                )}
              </div>

              {/* Interaction Controls */}
              <div className="space-y-4 pt-4 border-t border-[#23272F]/20">
                {/* Big Hold-to-speak or Tap-to-speak Microphone button */}
                {!activeField?.is_sensitive_number && (
                  <div className="flex justify-center">
                    {voiceMode === 'push_to_talk' ? (
                      <button
                        type="button"
                        onPointerDown={() => setIsHoldingToSpeak(true)}
                        onPointerUp={() => setIsHoldingToSpeak(false)}
                        onPointerLeave={() => setIsHoldingToSpeak(false)}
                        className={`touch-target-64 w-full max-w-sm py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 border-3 transition active:scale-95 ${
                          isHoldingToSpeak
                            ? 'bg-[#B3261E] text-white border-[#B3261E] animate-pulse'
                            : 'bg-[#1F3FBF] text-white border-[#1F3FBF] hover:bg-blue-800'
                        }`}
                      >
                        <Mic className="w-8 h-8" />
                        <span>
                          {isHoldingToSpeak
                            ? (selectedLang === 'ta' ? 'பேசுங்கள்... கைவிட்டால் அனுப்பும்' : 'Listening... release to send')
                            : (selectedLang === 'ta' ? 'அழுத்திப் பேசவும்' : 'Hold to Speak')}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsListening(!isListening)}
                        className={`touch-target-64 w-full max-w-sm py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 border-3 transition active:scale-95 ${
                          isListening
                            ? 'bg-[#B3261E] text-white border-[#B3261E] animate-pulse'
                            : 'bg-[#1F3FBF] text-white border-[#1F3FBF] hover:bg-blue-800'
                        }`}
                      >
                        <Mic className="w-8 h-8" />
                        <span>
                          {isListening
                            ? (selectedLang === 'ta' ? 'கேட்கிறது... தட்டினால் முடியும்' : 'Listening...')
                            : (selectedLang === 'ta' ? 'பேசத் தொடங்குங்கள்' : 'Tap to Speak')}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Secondary Actions: Keyboard & Camera Photo */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowKeyboard(!showKeyboard)}
                    className="touch-target-64 px-4 py-3 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded-lg flex items-center gap-2 hover:bg-[#D5BDAF] transition active:scale-95"
                  >
                    <Keyboard className="w-6 h-6 text-[#5B2A86]" />
                    <span>{selectedLang === 'ta' ? 'தட்டச்சு விசைப்பலகை' : 'On-Screen Keyboard'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="touch-target-64 px-4 py-3 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded-lg flex items-center gap-2 hover:bg-[#D5BDAF] transition active:scale-95"
                  >
                    <Camera className="w-6 h-6 text-[#1F3FBF]" />
                    <span>{selectedLang === 'ta' ? 'ஆவண புகைப்படம்' : 'Take Document Photo'}</span>
                  </button>
                </div>

                {/* Question Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    disabled={currentFieldIndex === 0}
                    onClick={() => {
                      if (currentFieldIndex > 0 && wsRef.current) {
                        wsRef.current.send(JSON.stringify({ type: 'back' }));
                      }
                    }}
                    className="touch-target-64 px-4 py-2 bg-[#D6CCC2] text-[#23272F] font-bold border-2 border-[#23272F] rounded hover:bg-gray-300 disabled:opacity-40 transition"
                  >
                    <ArrowLeft className="w-5 h-5 inline mr-1" />
                    <span>{selectedLang === 'ta' ? 'முந்தைய கேள்வி' : 'Previous'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(KIOSK_STEPS.REVIEW)}
                    className="touch-target-64 px-5 py-2 bg-[#5B2A86] text-white font-bold border-2 border-[#5B2A86] rounded hover:opacity-90 transition"
                  >
                    <span>{selectedLang === 'ta' ? 'சரிபார்த்தல்' : 'Review Form'}</span>
                    <ArrowRight className="w-5 h-5 inline ml-1" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right / Bottom: The Paper Sheet */}
            <div className="lg:w-1/2 bg-[#F5EBE0] border-2 border-[#23272F] rounded-lg p-6 overflow-y-auto max-h-[70vh] paper-sheet">
              <div className="border-b-2 border-[#23272F] pb-3 mb-4 flex justify-between items-center">
                <h3 className="text-xl font-bold font-serif-printed">{selectedService?.title}</h3>
                <span className="text-xs bg-[#D6CCC2] px-2 py-1 rounded font-mono font-bold">
                  {selectedLang === 'ta' ? 'படிவத் தாள்' : 'Application Sheet'}
                </span>
              </div>

              <div className="space-y-3">
                {fields.map((f, idx) => {
                  const isActive = idx === currentFieldIndex;
                  const val = answers[f.id];
                  const qText = selectedLang === 'ta' && f.question_ta ? f.question_ta : (f.question_en || f.field_name);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (wsRef.current) {
                          wsRef.current.send(JSON.stringify({ type: 'goto', field_id: f.id }));
                        }
                      }}
                      className={`ruled-row p-3 rounded cursor-pointer transition flex justify-between items-center ${
                        isActive ? 'active-highlighter-row border-2 border-[#23272F]' : 'hover:bg-[#D6CCC2]/40'
                      }`}
                    >
                      <div className="pr-4">
                        <span className="text-xs font-mono text-[#23272F]/70 block">
                          #{idx + 1} {f.field_name}
                        </span>
                        <p className="text-sm font-medium text-[#23272F]">{qText}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {val ? (
                          <span className="pen-blue-text text-base font-bold">{val}</span>
                        ) : (
                          <span className="text-xs italic text-[#23272F]/50">
                            {selectedLang === 'ta' ? 'பதிலளிக்கவில்லை' : 'Unfilled'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW */}
        {step === KIOSK_STEPS.REVIEW && (
          <div className="max-w-3xl mx-auto w-full bg-[#F5EBE0] border-3 border-[#23272F] rounded-xl p-6 md:p-8 space-y-6 my-auto shadow-md">
            <div className="border-b-2 border-[#23272F] pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold font-serif-printed text-[#23272F]">
                  {selectedLang === 'ta' ? 'விண்ணப்பத்தை சரிபார்க்கவும்' : 'Review your answers'}
                </h2>
                <p className="text-sm text-[#23272F]/70">
                  {selectedLang === 'ta'
                    ? 'எல்லா விவரங்களும் சரியாக உள்ளதா என பார்த்து சமர்ப்பிக்கவும்.'
                    : 'Check your answers before submitting for official processing.'}
                </p>
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto border border-[#23272F] rounded p-4 space-y-3">
              {fields.map((f, idx) => {
                const val = answers[f.id];
                const qText = selectedLang === 'ta' && f.question_ta ? f.question_ta : (f.question_en || f.field_name);
                return (
                  <div key={f.id} className="flex justify-between items-center ruled-row pb-2">
                    <div>
                      <span className="text-xs font-mono text-[#23272F]/70 block">#{idx + 1}</span>
                      <p className="text-sm font-semibold">{qText}</p>
                    </div>
                    <div className="text-right">
                      {val ? (
                        <span className="pen-blue-text text-base font-bold">{val}</span>
                      ) : (
                        <span className="text-xs text-[#B3261E] font-bold">
                          {selectedLang === 'ta' ? 'விடுபட்டுள்ளது' : 'Missing'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-[#23272F]/30">
              <button
                type="button"
                onClick={() => setStep(KIOSK_STEPS.VOICE_FILL)}
                className="touch-target-64 px-6 py-4 bg-[#D6CCC2] text-[#23272F] font-bold text-lg rounded-lg border-2 border-[#23272F] hover:bg-gray-300 transition"
              >
                {selectedLang === 'ta' ? 'பதில்களை மாற்றுக' : 'Change Answers'}
              </button>

              <button
                type="button"
                onClick={handleSubmitApplication}
                disabled={isSubmitting}
                className="touch-target-64 flex-1 py-4 bg-[#5B2A86] text-white font-bold text-xl rounded-lg border-2 border-[#5B2A86] hover:opacity-90 active:scale-95 transition shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Check className="w-7 h-7" />
                <span>
                  {isSubmitting
                    ? (selectedLang === 'ta' ? 'சமர்ப்பிக்கிறது...' : 'Submitting...')
                    : (selectedLang === 'ta' ? 'விண்ணப்பத்தை சமர்ப்பிக்கவும்' : 'Submit Application')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: SUBMITTED RECEIPT & FINISH */}
        {step === KIOSK_STEPS.RECEIPT && (
          <div className="max-w-2xl mx-auto w-full space-y-6 my-auto text-center">
            <div className="bg-[#F5EBE0] border-3 border-[#23272F] rounded-xl p-6 md:p-8 shadow-xl">
              <div className="flex justify-center mb-4">
                <div className="stamp-received">
                  <span className="text-xs block font-mono">OFFICE</span>
                  <span className="text-2xl font-bold font-sans-counter">
                    {selectedLang === 'ta' ? 'பெறப்பட்டது' : 'RECEIVED'}
                  </span>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold font-serif-printed text-[#23272F]">
                {selectedLang === 'ta' ? 'விண்ணப்பம் வெற்றிகரமாக பெறப்பட்டது!' : 'Application Submitted!'}
              </h2>
              <p className="text-sm text-[#23272F]/70 mt-1">
                {selectedLang === 'ta' ? brandConfig.disclaimerTa : brandConfig.disclaimerEn}
              </p>

              {/* Reference Number in Boxed Cells */}
              <div className="my-6 p-4 bg-[#D6CCC2]/40 border-2 border-[#23272F] rounded-lg">
                <span className="text-xs uppercase font-mono font-bold text-[#23272F]/70 block mb-2">
                  {selectedLang === 'ta' ? 'உங்கள் குறிப்பு எண் (Reference Number)' : 'Your Reference Number'}
                </span>
                <div className="flex justify-center flex-wrap gap-1.5">
                  {(submissionData?.reference_number || 'CS-DEMO-REF1').split('').map((c, i) => (
                    <span key={`box-${i}`} className="boxed-char kiosk-boxed-char">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Printing Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                <button
                  type="button"
                  onClick={() => handlePrint('slip')}
                  className="touch-target-64 py-4 px-6 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] hover:bg-[#D5BDAF] rounded-lg flex items-center justify-center gap-3 transition active:scale-95 shadow"
                >
                  <Printer className="w-6 h-6 text-[#5B2A86]" />
                  <span>{selectedLang === 'ta' ? 'ரசீதை அச்சிடு (80mm)' : 'Print Receipt Slip (80mm)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint('a4')}
                  className="touch-target-64 py-4 px-6 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] hover:bg-[#D5BDAF] rounded-lg flex items-center justify-center gap-3 transition active:scale-95 shadow"
                >
                  <FileText className="w-6 h-6 text-[#1F3FBF]" />
                  <span>{selectedLang === 'ta' ? 'முழு படிவ நகல் (A4)' : 'Print Full A4 Copy'}</span>
                </button>
              </div>

              {/* Finish and Wipe Button */}
              <button
                type="button"
                onClick={wipeSessionAndReset}
                className="touch-target-64 w-full py-5 bg-[#5B2A86] text-white font-bold text-2xl rounded-lg hover:opacity-90 active:scale-95 transition shadow-lg"
              >
                {selectedLang === 'ta' ? 'முடித்து திரையை அழிக்கவும்' : 'Finish & Reset Kiosk'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* On-Screen Virtual Keyboard Drawer */}
      {showKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-[#F5EBE0] border-t-2 border-[#23272F] p-3 flex gap-2 items-center">
            <input
              type="text"
              value={typedInputText}
              onChange={(e) => setTypedInputText(e.target.value)}
              placeholder={selectedLang === 'ta' ? 'பதிலை தட்டச்சு செய்யவும்...' : 'Type answer...'}
              className="touch-target-64 flex-1 text-xl px-4 border-2 border-[#23272F] rounded bg-white"
              autoFocus
            />
            <button
              type="button"
              onClick={handleVirtualKeyboardDone}
              className="touch-target-64 px-6 bg-[#5B2A86] text-white font-bold rounded"
            >
              Done
            </button>
          </div>
          <TamilVirtualKeyboard
            defaultLang={selectedLang}
            onInsert={(char) => setTypedInputText((prev) => prev + char)}
            onBackspace={() => setTypedInputText((prev) => prev.slice(0, -1))}
            onClear={() => setTypedInputText('')}
            onClose={() => setShowKeyboard(false)}
          />
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        lang={selectedLang}
        maxPages={3}
        onPhotoCaptured={async (blobs) => {
          if (!kioskSession || blobs.length === 0) return;
          const formData = new FormData();
          formData.append('file', blobs[0], 'document.jpg');
          try {
            await fetch(`/submissions/${kioskSession.submission_id}/documents`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${kioskSession.scoped_token}` },
              body: formData
            });
            alert(selectedLang === 'ta' ? 'ஆவணம் வெற்றிகரமாக படிக்கப்பட்டது.' : 'Document extracted successfully.');
          } catch (e) {
            console.error('[Doc photo upload error]:', e);
          }
        }}
      />

      {/* Idle Countdown Modal ("Are you still there?") */}
      {idleModalVisible && (
        <div className="fixed inset-0 z-50 bg-[#23272F]/85 flex items-center justify-center p-4">
          <div className="bg-[#F5EBE0] border-4 border-[#B3261E] rounded-xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-[#B3261E] mx-auto animate-pulse" />
            <h2 className="text-3xl font-bold font-serif-printed text-[#23272F]">
              {selectedLang === 'ta' ? 'நீங்கள் இன்னும் இங்கே இருக்கிறீர்களா?' : 'Are you still there?'}
            </h2>
            <p className="text-xl text-[#23272F]/80">
              {selectedLang === 'ta'
                ? `உங்கள் பாதுகாப்பிற்காக, இந்த சாதனம் ${idleCountdown} நொடிகளில் அழிக்கப்படும்.`
                : `For your privacy, this kiosk will reset in ${idleCountdown} seconds.`}
            </p>
            <div className="text-5xl font-mono font-bold text-[#B3261E]">{idleCountdown}s</div>
            <button
              type="button"
              onClick={resetIdleTimer}
              className="touch-target-64 w-full py-4 bg-[#5B2A86] text-white font-bold text-2xl rounded-lg hover:opacity-90 active:scale-95 transition"
            >
              {selectedLang === 'ta' ? 'ஆம், நான் தொடர்கிறேன்' : 'I am still here'}
            </button>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY VIEWS FOR window.print */}
      <div className="hidden print-only">
        {printType === 'slip' ? (
          <ReceiptSlipPrint
            submission={submissionData}
            formTitle={selectedService?.title}
            lang={selectedLang}
          />
        ) : (
          <ApplicationA4Print
            submission={submissionData}
            form={selectedService}
            fields={fields}
            answers={Object.entries(answers).map(([field_id, value]) => ({ field_id: Number(field_id), value }))}
            lang={selectedLang}
          />
        )}
      </div>
    </div>
  );
}
