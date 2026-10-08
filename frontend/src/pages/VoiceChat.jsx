import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userFormsApi } from '../api/client';
import { useVad } from '../hooks/useVad';
import { useSpeech } from '../hooks/useSpeech';
import { Navbar } from '../components/Navbar';
import { PrivacyNoticeModal } from '../components/PrivacyNoticeModal';
import {
  Mic, MicOff, Send, CheckCircle2, ArrowLeft, RotateCcw, Volume2, VolumeX,
  Globe, ShieldCheck, Sparkles, AlertCircle, Edit3, Activity, Code, Lock, X, Undo2, Headphones
} from 'lucide-react';

const VAD_SILENCE_CONFIG = {
  String: 600,
  Number: 600,
  Boolean: 600,
  Choice: 600,
  Email: 1200,
  Phone: 1200,
  Date: 1200
};

export const VoiceChat = () => {
  const { submissionId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  // Settings & Toggles
  const [uiLang, setUiLang] = useState('en'); // 'en' | 'ta' | 'auto'
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  // Server State Truth
  const [currentField, setCurrentField] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({}); // field_id -> value
  const [isDone, setIsDone] = useState(false);
  const [mode, setMode] = useState('normal'); // 'normal' | 'editing'
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [updatedFieldId, setUpdatedFieldId] = useState(null);

  // Notifications & Toast
  const [undoToast, setUndoToast] = useState(null);
  const [headphoneHint, setHeadphoneHint] = useState(false);

  // Chat UI Messages & Input
  const [chatMessages, setChatMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [offeredTypedInput, setOfferedTypedInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Turn Timings & Filter Debug Info (Fix 4)
  const [latestTiming, setLatestTiming] = useState(null);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const { speak, stop: stopSpeech, isSpeaking } = useSpeech(speechEnabled);

  // Silence duration based on server's current field data type
  const silenceDurationMs = currentField ? VAD_SILENCE_CONFIG[currentField.data_type] || 600 : 600;

  // Handle Speech End Callback from VAD
  const handleSpeechEnd = (wavBuffer) => {
    setUndoToast(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(wavBuffer);
    }
  };

  const {
    vadState,
    isListening,
    permissionState,
    errorDetails: micError,
    startListening,
    stopListening,
    toggleListening
  } = useVad({
    onSpeechEnd: handleSpeechEnd,
    silenceDurationMs,
    disabled: isSpeaking || (isDone && mode !== 'editing')
  });

  // Tapping mic resets retry counter and resumes listening cleanly (Fix 2)
  const handleMicTap = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset_mic' }));
    }
    setOfferedTypedInput(false);
    toggleListening();
  };

  // Cancel speech synthesis on language change
  useEffect(() => {
    stopSpeech();
  }, [uiLang, stopSpeech]);

  // Privacy Notice Modal Check
  useEffect(() => {
    const accepted = localStorage.getItem('voiceform_privacy_accepted');
    if (!accepted) {
      setPrivacyModalOpen(true);
    }
  }, []);

  // Keyboard shortcut Ctrl+Shift+D for Debug Panel, Escape to cancel editing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugPanelOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && mode === 'editing') {
        e.preventDefault();
        handleCancelEditing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Helper to prompt current field question safely
  const promptFieldQuestion = (fieldObj, language = uiLang, isEditing = false) => {
    if (!fieldObj) return;

    let qText = fieldObj.question_en;
    let speakLang = 'en';
    if (language === 'ta') {
      qText = fieldObj.question_ta || fieldObj.question_en;
      speakLang = 'ta';
    }

    if (isEditing) {
      const friendlyName = fieldObj.field_name.replace('_', ' ');
      qText = `Okay, let's redo your ${friendlyName}. ${qText}`;
    }

    setChatMessages((prev) => [
      ...prev,
      { sender: 'bot', text: qText, fieldName: fieldObj.field_name, fieldId: fieldObj.id }
    ]);

    speak(qText, speakLang, () => {
      startListening();
    });
  };

  // Sync state from server dict payload
  const applyServerState = (data) => {
    if (data.fields) setFields(data.fields);
    if ('current_field' in data) setCurrentField(data.current_field);
    if ('current_field_index' in data) setCurrentIndex(data.current_field_index);
    if ('done' in data) setIsDone(data.done);
    if ('mode' in data) setMode(data.mode);
    if ('editing_field_id' in data) setEditingFieldId(data.editing_field_id);

    if (data.answers) {
      const updatedAns = {};
      Object.entries(data.answers).forEach(([fId, aObj]) => {
        updatedAns[fId] = aObj.value;
      });
      setAnswers(updatedAns);
    }
  };

  // Connect WebSocket and handle server state updates
  useEffect(() => {
    if (!submissionId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/submissions/${submissionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token, language_hint: uiLang }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'ready') {
        applyServerState(data);

        if (data.done) {
          setChatMessages([
            { sender: 'bot', text: '👋 All required questions have been answered! You can review or complete your submission.' }
          ]);
        } else if (data.current_field) {
          setChatMessages([
            { sender: 'bot', text: "👋 Welcome! Let's fill out this voice form." }
          ]);
          promptFieldQuestion(data.current_field, uiLang);
        }
      }

      else if (data.type === 'transcript') {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'user', text: data.text, lang: data.language }
        ]);
      }

      else if (data.type === 'drop_silent') {
        setLatestTiming(data.debug_info || null);
        if (data.show_headphone_hint) {
          setHeadphoneHint(true);
        }
      }

      else if (data.type === 'mic_resumed') {
        applyServerState(data);
        setOfferedTypedInput(false);
      }

      else if (data.type === 'answer') {
        setLatestTiming(data.timing || null);
        applyServerState(data);
        setOfferedTypedInput(false);

        if (data.field_id) {
          setUpdatedFieldId(data.field_id);
          setTimeout(() => setUpdatedFieldId(null), 1500);

          setChatMessages((prev) =>
            prev.map((m) =>
              m.fieldId === data.field_id ? { ...m, replaced: true } : m
            )
          );

          const fieldObj = fields.find((f) => f.id === data.field_id);
          setUndoToast({
            fieldId: data.field_id,
            fieldName: fieldObj ? fieldObj.field_name.replace('_', ' ') : 'field'
          });
          setTimeout(() => setUndoToast(null), 5000);
        }

        if (data.done) {
          const completionMsg = '🎉 Thank you! All required questions are complete. Please review your answers and submit.';
          setChatMessages((prev) => [...prev, { sender: 'bot', text: completionMsg }]);
          speak(completionMsg, 'en');
        } else if (data.current_field) {
          promptFieldQuestion(data.current_field, uiLang, data.mode === 'editing');
        }
      }

      else if (data.type === 'follow_up') {
        setLatestTiming(data.timing || null);
        applyServerState(data);
        setChatMessages((prev) => [...prev, { sender: 'bot', text: data.text }]);
        speak(data.text, uiLang === 'ta' ? 'ta' : 'en', () => startListening());
      }

      else if (data.type === 'navigate') {
        applyServerState(data);
        if (data.text) {
          setChatMessages((prev) => [...prev, { sender: 'bot', text: data.text }]);
          speak(data.text, 'en', () => startListening());
        } else if (data.current_field) {
          promptFieldQuestion(data.current_field, uiLang, data.mode === 'editing');
        }
      }

      else if (data.type === 'offer_typed_input') {
        setOfferedTypedInput(true);
        setChatMessages((prev) => [...prev, { sender: 'bot', text: data.message }]);
        speak(data.message, 'en');
      }

      else if (data.type === 'done') {
        applyServerState(data);
        setChatMessages((prev) => [...prev, { sender: 'bot', text: data.message }]);
      }

      else if (data.type === 'error') {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'bot', text: `⚠️ ${data.message}`, isError: true }
        ]);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
      stopSpeech();
      stopListening();
    };
  }, [submissionId, token]);

  // Handle Pencil Click
  const handleGotoField = (fieldId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'goto', field_id: fieldId }));
      inputRef.current?.focus();
    }
  };

  // Handle Back Button click
  const handleBackButton = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'back' }));
    }
  };

  // Handle Undo Click
  const handleUndo = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'undo' }));
      setUndoToast(null);
    }
  };

  // Handle Cancel Editing
  const handleCancelEditing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel_edit' }));
    }
  };

  // Handle Manual Text Input Submit
  const handleSendText = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const val = textInput.trim();
    setTextInput('');
    setUndoToast(null);

    setChatMessages((prev) => [
      ...prev,
      { sender: 'user', text: val, fieldId: currentField?.id }
    ]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'text_input',
          text: val,
          field_id: currentField?.id
        })
      );
    }
  };

  // Complete Submission
  const handleCompleteSubmission = async () => {
    setSubmitting(true);
    try {
      const answersPayload = fields.map((f) => ({
        field_id: f.id,
        value: answers[f.id] || null,
        raw_transcript: answers[f.id] || null,
        language: 'en'
      }));

      await userFormsApi.completeSubmission(submissionId, answersPayload);
      navigate('/user');
    } catch (err) {
      alert(err.message || 'Failed to complete submission');
    } flex: true;
      setSubmitting(false);
  };

  const activeEditingField = fields.find((f) => f.id === editingFieldId) || currentField;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">
      <Navbar
        uiLang={uiLang}
        setUiLang={setUiLang}
        speechEnabled={speechEnabled}
        setSpeechEnabled={setSpeechEnabled}
      />

      <PrivacyNoticeModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      {/* Main Grid: Left Chat (65%) | Right Side Panel (35%) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex gap-6 overflow-hidden">
        {/* LEFT: Voice Chat Panel */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center space-x-3">
              <Link
                to="/user"
                className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Voice Chat Assistant</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </h2>
                <p className="text-[11px] text-slate-400">
                  {mode === 'editing'
                    ? `✏️ Editing: ${activeEditingField?.field_name.replace('_', ' ')}`
                    : isDone
                    ? '🎉 Form complete! Review & submit.'
                    : currentField
                    ? `Current Field: ${currentField.field_name.replace('_', ' ')} (${currentField.data_type})`
                    : 'Session active'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center space-x-1 border ${
                  permissionState === 'granted'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : permissionState === 'denied'
                    ? 'bg-red-950 text-red-300 border-red-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}
              >
                <Mic className="w-3 h-3" />
                <span>Mic: {permissionState}</span>
              </span>

              <button
                onClick={() => setDebugPanelOpen(!debugPanelOpen)}
                className={`p-2 rounded-xl border text-xs font-mono transition-colors flex items-center space-x-1 ${
                  debugPanelOpen ? 'bg-indigo-950 text-indigo-300 border-indigo-700' : 'bg-slate-800/60 text-slate-400 border-slate-700'
                }`}
                title="Toggle Latency & Filter Debug Panel (Ctrl+Shift+D)"
              >
                <Code className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Debug</span>
              </button>
            </div>
          </div>

          {/* Headphone Recommendation Hint */}
          {headphoneHint && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-indigo-950/90 border border-indigo-700 text-indigo-200 text-xs flex items-center justify-between shadow-lg animate-fade-in">
              <div className="flex items-center space-x-2">
                <Headphones className="w-4 h-4 text-indigo-400" />
                <span>Audio echo detected multiple times. Using headphones is recommended for best accuracy.</span>
              </div>
              <button onClick={() => setHeadphoneHint(false)} className="text-indigo-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Editing Mode Active Banner */}
          {mode === 'editing' && activeEditingField && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex items-center justify-between shadow-lg animate-fade-in">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>
                  Editing Field: <strong>{activeEditingField.field_name.replace('_', ' ')}</strong> ({activeEditingField.data_type})
                </span>
              </div>
              <button
                onClick={handleCancelEditing}
                className="px-2.5 py-1 bg-amber-900/80 hover:bg-amber-800 text-amber-100 rounded-lg text-xs flex items-center space-x-1 transition-colors"
                title="Cancel editing (Press Escape)"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          )}

          {/* Mic Error Banner */}
          {micError && (
            <div className="m-4 p-4 rounded-2xl bg-red-950/90 border border-red-800 text-red-200 text-xs flex items-start space-x-3 shadow-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-red-100 mb-0.5">Microphone Warning</strong>
                <span>{micError}</span>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md transition-all ${
                    msg.replaced
                      ? 'bg-slate-950/40 border border-slate-800/50 text-slate-500 line-through'
                      : msg.isError
                      ? 'bg-red-950 border border-red-800 text-red-200'
                      : msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.replaced && (
                    <span className="text-[10px] no-underline font-mono text-slate-500 block mt-1">
                      [Replaced by edit]
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Undo Toast Floating Bar */}
          {undoToast && (
            <div className="mx-4 mb-2 p-3 rounded-xl bg-indigo-950 border border-indigo-700 text-indigo-200 text-xs flex items-center justify-between shadow-2xl animate-fade-in">
              <span>Saved answer for <strong>{undoToast.fieldName}</strong>.</span>
              <button
                onClick={handleUndo}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center space-x-1 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            </div>
          )}

          {/* Offered Typed Input Notice */}
          {offeredTypedInput && (
            <div className="mx-4 p-3 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex items-center justify-between">
              <span>Having trouble capturing voice? Type your response below or tap the mic to retry.</span>
              <button onClick={handleMicTap} className="px-2 py-1 bg-amber-900 hover:bg-amber-800 rounded text-amber-100 font-semibold">
                Tap Mic
              </button>
            </div>
          )}

          {/* Bottom Voice Controls & Input Bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
            {/* VAD Status & Pulsing Mic Button */}
            <div className="flex items-center justify-center space-x-4">
              <button
                type="button"
                onClick={handleMicTap}
                className={`relative p-5 rounded-full shadow-2xl transition-all ${
                  vadState === 'speech_detected'
                    ? 'bg-red-600 text-white animate-pulse-ring scale-110'
                    : isListening
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={isListening ? 'Click to pause mic' : 'Click to activate mic & reset counter'}
              >
                {isListening ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
              </button>

              <div className="text-xs font-mono uppercase tracking-wider">
                {vadState === 'speech_detected' && (
                  <span className="text-red-400 font-bold flex items-center space-x-1">
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Speech Detected...</span>
                  </span>
                )}
                {vadState === 'listening' && (
                  <span className="text-indigo-400 font-semibold">Listening (Silero VAD)...</span>
                )}
                {vadState === 'processing' && (
                  <span className="text-purple-400 font-semibold">Transcribing & Extracting...</span>
                )}
                {vadState === 'idle' && (
                  <span className="text-slate-500">MIC PAUSED (TAP TO SPEAK)</span>
                )}
              </div>
            </div>

            {/* Manual Text Input & Navigation Bar */}
            <form onSubmit={handleSendText} className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={handleBackButton}
                disabled={currentIndex === 0}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 rounded-xl transition-colors flex items-center space-x-1 text-xs font-semibold"
                title="Go back to previous question"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  mode === 'editing' && activeEditingField
                    ? `Type updated ${activeEditingField.field_name.replace('_', ' ')}...`
                    : "Or type your response manually here..."
                }
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-500"
              />

              <button
                type="submit"
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: Live Form Panel */}
        <div className="hidden lg:flex w-96 bg-slate-900 border border-slate-800 rounded-3xl flex-col shadow-2xl p-6 space-y-6 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-white text-base">Live Form Panel</h3>
              <p className="text-xs text-slate-400">
                Click pencil to redo any field.
              </p>
            </div>
            <div className="px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-lg text-xs font-mono font-bold">
              {Object.keys(answers).length} / {fields.length}
            </div>
          </div>

          {/* Fields List */}
          <div className="space-y-3 flex-1">
            {fields.map((field) => {
              const isCurrent = currentField?.id === field.id;
              const isEditingThis = mode === 'editing' && editingFieldId === field.id;
              const hasAnswer = answers[field.id] !== undefined && answers[field.id] !== null && String(answers[field.id]).trim() !== '';
              const isUpdated = updatedFieldId === field.id;

              return (
                <div
                  key={field.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEditingThis
                      ? 'bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-950/50 scale-[1.02]'
                      : isUpdated
                      ? 'bg-emerald-950/60 border-emerald-500 animate-bounce'
                      : isCurrent
                      ? 'bg-indigo-950/60 border-indigo-600 shadow-lg shadow-indigo-950/50'
                      : hasAnswer
                      ? 'bg-slate-950 border-slate-800/80'
                      : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                      <span>{field.field_name.replace('_', ' ')}</span>
                      {hasAnswer && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {field.data_type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold text-emerald-400 truncate max-w-[220px]">
                      {hasAnswer ? answers[field.id] : <span className="text-slate-600 font-normal italic">Unfilled</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleGotoField(field.id)}
                      className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                      title={`Redo ${field.field_name.replace('_', ' ')}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          <div className="space-y-1">
            <button
              onClick={handleCompleteSubmission}
              disabled={submitting || mode === 'editing' || !isDone}
              title={
                mode === 'editing'
                  ? 'Finish editing active field before submitting.'
                  : !isDone
                  ? 'Complete all required questions to submit.'
                  : 'Submit completed form'
              }
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete & Submit Form</span>
            </button>
            {mode === 'editing' && (
              <p className="text-[11px] text-amber-400 text-center font-mono">
                Editing active field — complete or cancel to submit.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Latency & Filter Debug Panel (Fix 4) */}
      {debugPanelOpen && (
        <div className="bg-slate-900 border-t border-slate-800 p-4 text-xs font-mono text-slate-300 flex flex-col space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-indigo-400 font-bold">Voice Pipeline Debugger (Fix 4):</span>
            <button onClick={() => setDebugPanelOpen(false)} className="text-slate-500 hover:text-white">
              Close
            </button>
          </div>

          {latestTiming ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block">Raw Transcript:</span>
                <strong className="text-white truncate block">{latestTiming.raw_transcript || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Filter Status:</span>
                <strong className={latestTiming.filter_status === 'clean' ? 'text-emerald-400' : 'text-amber-400'}>
                  {latestTiming.filter_status || 'clean'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Command vs Answer:</span>
                <strong className="text-purple-300">{latestTiming.command_versus_answer || 'answer'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Counted as Failure:</span>
                <strong className={latestTiming.counted_as_failure ? 'text-red-400' : 'text-slate-400'}>
                  {latestTiming.counted_as_failure ? 'YES (Failed Turn)' : 'NO'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Normalized Text:</span>
                <strong className="text-indigo-300 truncate block">{latestTiming.normalized_text || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Grounding Status:</span>
                <strong className={latestTiming.grounding_result === 'grounded' ? 'text-emerald-400' : 'text-red-400'}>
                  {latestTiming.grounding_result || 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">STT Latency:</span>
                <strong className="text-white">{latestTiming.stt_ms}ms</strong>
              </div>
              <div>
                <span className="text-slate-500 block">LLM Latency:</span>
                <strong className="text-white">{latestTiming.llm_ms}ms</strong>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 italic">No turn processed yet. Speak into mic or submit text to inspect debug state.</p>
          )}
        </div>
      )}
    </div>
  );
};
