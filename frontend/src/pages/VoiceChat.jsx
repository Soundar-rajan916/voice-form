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
  Globe, ShieldCheck, Sparkles, AlertCircle, Edit3, Activity, Code, Lock, X, Undo2, Headphones,
  Paperclip, Upload, FileText, Check, AlertTriangle, Info, CheckCheck
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
  const [uiLang, setUiLang] = useState('en');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  // Server State Truth
  const [currentField, setCurrentField] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [proposals, setProposals] = useState([]);
  const [isDone, setIsDone] = useState(false);
  const [mode, setMode] = useState('normal');
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [updatedFieldId, setUpdatedFieldId] = useState(null);
  const [allAnswered, setAllAnswered] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [submissionStatus, setSubmissionStatus] = useState('in_progress');

  // Document Upload & Progress State
  const [docUploading, setDocUploading] = useState(false);
  const [docProgress, setDocProgress] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Proposal Editing Modal State
  const [editingProposal, setEditingProposal] = useState(null);
  const [editingProposalVal, setEditingProposalVal] = useState('');

  // Notifications & Toast
  const [undoToast, setUndoToast] = useState(null);
  const [headphoneHint, setHeadphoneHint] = useState(false);

  // Chat UI Messages & Input
  const [chatMessages, setChatMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [offeredTypedInput, setOfferedTypedInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Turn Timings
  const [latestTiming, setLatestTiming] = useState(null);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const { speak, stop: stopSpeech, isSpeaking } = useSpeech(speechEnabled);
  const silenceDurationMs = currentField ? VAD_SILENCE_CONFIG[currentField.data_type] || 600 : 600;

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
    disabled: isSpeaking || submissionStatus === 'submitted'
  });

  const handleMicTap = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset_mic' }));
    }
    setOfferedTypedInput(false);
    toggleListening();
  };

  useEffect(() => {
    stopSpeech();
  }, [uiLang, stopSpeech]);

  useEffect(() => {
    const accepted = localStorage.getItem('voiceform_privacy_accepted');
    if (!accepted) {
      setPrivacyModalOpen(true);
    }
  }, []);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  const applyServerState = (data) => {
    if (data.fields) setFields(data.fields);
    if ('current_field' in data) setCurrentField(data.current_field);
    if ('current_field_index' in data) setCurrentIndex(data.current_field_index);
    if ('done' in data) setIsDone(data.done);
    if ('mode' in data) setMode(data.mode);
    if ('editing_field_id' in data) setEditingFieldId(data.editing_field_id);
    if ('all_answered' in data) setAllAnswered(data.all_answered);
    if ('can_edit' in data) setCanEdit(data.can_edit);
    if ('submission_status' in data) setSubmissionStatus(data.submission_status);

    if (data.answers) {
      const updatedAns = {};
      Object.entries(data.answers).forEach(([fId, aObj]) => {
        updatedAns[fId] = aObj.value;
      });
      setAnswers(updatedAns);
    }

    if (data.proposals) {
      setProposals(data.proposals);
    }
  };

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
        if (data.submission_status === 'submitted') {
          setChatMessages([
            { sender: 'bot', text: '🔒 This form has already been submitted and is locked for editing.' }
          ]);
        } else if (data.all_answered || data.mode === 'review') {
          setChatMessages([
            { sender: 'bot', text: '🎉 All questions answered. Review your answers, edit anything, then press Submit.' }
          ]);
        } else if (data.current_field) {
          setChatMessages([
            { sender: 'bot', text: "👋 Welcome! Let's fill out this form." }
          ]);
          promptFieldQuestion(data.current_field, uiLang);
        }
      }

      else if (data.type === 'document_status') {
        setDocProgress({ message: data.message, progress: data.progress });
        if (data.progress >= 100) {
          setTimeout(() => setDocProgress(null), 3000);
        }
      }

      else if (data.type === 'state_sync') {
        applyServerState(data);
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

        if (data.mode === 'review' || data.all_answered) {
          const completionMsg = '🎉 All questions answered. Review your answers, edit anything, then press Submit.';
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

      else if (data.type === 'submitted') {
        applyServerState(data);
        setSubmitting(false);
        const submittedMsg = '🎉 Form successfully submitted! Thank you.';
        setChatMessages((prev) => [...prev, { sender: 'bot', text: submittedMsg }]);
        speak(submittedMsg, 'en');
      }

      else if (data.type === 'error') {
        setSubmitting(false);
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

  // Document File Upload Handler
  const handleUploadFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      alert('Only .pdf and .docx files are accepted.');
      return;
    }

    const acceptedPrivacy = localStorage.getItem('voiceform_privacy_accepted');
    if (!acceptedPrivacy) {
      setPrivacyModalOpen(true);
      return;
    }

    setDocUploading(true);
    setDocProgress({ message: 'Uploading document...', progress: 5 });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/submissions/${submissionId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Document upload failed');
      }

      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `📄 ${data.message || 'Extracted proposals from document.'}` }
      ]);
      if (data.proposals) {
        setProposals(data.proposals);
      }
    } catch (err) {
      alert(`Document Upload Error: ${err.message}`);
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `⚠️ Document processing error: ${err.message}`, isError: true }
      ]);
    } finally {
      setDocUploading(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Proposal Actions via WebSocket
  const handleAcceptProposals = (proposalIds = null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'accept_proposals',
        proposal_ids: proposalIds
      }));
    }
  };

  const handleDismissProposal = (proposalId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'dismiss_proposal',
        proposal_id: proposalId
      }));
    }
  };

  const handleEditProposalSubmit = (e) => {
    e.preventDefault();
    if (!editingProposal || !editingProposalVal.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'edit_proposal',
        proposal_id: editingProposal.id,
        new_value: editingProposalVal.trim()
      }));
    }
    setEditingProposal(null);
    setEditingProposalVal('');
  };

  const handleGotoField = (fieldId) => {
    if (submissionStatus === 'submitted') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'goto', field_id: fieldId }));
      inputRef.current?.focus();
    }
  };

  const handleBackButton = () => {
    if (submissionStatus === 'submitted') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'back' }));
    }
  };

  const handleUndo = () => {
    if (submissionStatus === 'submitted') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'undo' }));
      setUndoToast(null);
    }
  };

  const handleCancelEditing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel_edit' }));
    }
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!textInput.trim() || submissionStatus === 'submitted') return;

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

  const handleCompleteSubmission = async () => {
    setSubmitting(true);
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'submit' }));
      } else {
        const answersPayload = fields.map((f) => ({
          field_id: f.id,
          value: answers[f.id] || null,
          raw_transcript: answers[f.id] || null,
          language: 'en'
        }));
        await userFormsApi.completeSubmission(submissionId, answersPayload);
        setSubmissionStatus('submitted');
        setCanEdit(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const activeEditingField = fields.find((f) => f.id === editingFieldId) || currentField;
  const eligibleAcceptAllCount = proposals.filter((p) => !p.is_excluded_from_accept_all).length;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#022B3A] text-[#FFFFFF] flex flex-col h-screen overflow-hidden relative"
    >
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

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-950/90 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-indigo-400 animate-fade-in pointer-events-none">
          <Upload className="w-16 h-16 text-indigo-400 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-white">Drop Document Here</h2>
          <p className="text-sm text-indigo-200 mt-2">Only .pdf and .docx files will be extracted via Vision AI</p>
        </div>
      )}

      {/* Main Grid: Left Chat (65%) | Right Side Panel (35%) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex gap-6 overflow-hidden">
        {/* LEFT: Voice Chat Panel */}
        <div className="flex-1 bg-[#022B3A] border border-[#1F7A8C]/40 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
          {/* Header */}
          <div className="p-4 border-b border-[#1F7A8C]/30 flex items-center justify-between bg-[#022B3A]">
            <div className="flex items-center space-x-3">
              <Link
                to="/user"
                className="p-2 bg-[#1F7A8C]/30 hover:bg-[#1F7A8C]/60 text-[#BFDBF7] hover:text-[#FFFFFF] rounded-xl transition-colors border border-[#1F7A8C]/40"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h2 className="text-base font-bold text-[#FFFFFF] flex items-center space-x-2">
                  <span>Voice & Document Assistant</span>
                  {submissionStatus === 'submitted' ? (
                    <Lock className="w-4 h-4 text-[#BFDBF7]" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {submissionStatus === 'submitted'
                    ? '🔒 Form submitted & locked'
                    : mode === 'editing'
                    ? `✏️ Editing: ${activeEditingField?.field_name.replace('_', ' ')}`
                    : allAnswered || mode === 'review'
                    ? '🎉 Review stage: All required questions answered'
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
                title="Toggle Latency & Debug Panel"
              >
                <Code className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Debug</span>
              </button>
            </div>
          </div>

          {/* Document Status / Progress Banner */}
          {docProgress && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-indigo-950/90 border border-indigo-700 text-indigo-200 text-xs shadow-lg animate-fade-in space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span>{docProgress.message}</span>
                </span>
                <span className="font-mono text-indigo-300">{docProgress.progress}%</span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${docProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Headphone Hint */}
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
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Controls Bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
            <div className="flex items-center justify-center space-x-4">
              <button
                type="button"
                onClick={handleMicTap}
                disabled={submissionStatus === 'submitted'}
                className={`relative p-5 rounded-full shadow-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  vadState === 'speech_detected'
                    ? 'bg-red-600 text-white animate-pulse-ring scale-110'
                    : isListening
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {isListening ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
              </button>

              <div className="text-xs font-mono uppercase tracking-wider">
                {submissionStatus === 'submitted' ? (
                  <span className="text-slate-500">FORM SUBMITTED (READ-ONLY)</span>
                ) : vadState === 'speech_detected' ? (
                  <span className="text-red-400 font-bold flex items-center space-x-1">
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Speech Detected...</span>
                  </span>
                ) : vadState === 'listening' ? (
                  <span className="text-indigo-400 font-semibold">Listening (Silero VAD)...</span>
                ) : vadState === 'processing' ? (
                  <span className="text-purple-400 font-semibold">Transcribing & Extracting...</span>
                ) : (
                  <span className="text-slate-500">MIC PAUSED (TAP TO SPEAK)</span>
                )}
              </div>
            </div>

            {/* Input Bar with Paperclip Attach Button */}
            <form onSubmit={handleSendText} className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={handleBackButton}
                disabled={currentIndex === 0 || submissionStatus === 'submitted'}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl transition-colors flex items-center space-x-1 text-xs font-semibold"
                title="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadFile(e.target.files[0]);
                  }
                }}
              />

              {/* Attach Paperclip Button */}
              <button
                type="button"
                disabled={submissionStatus === 'submitted' || docUploading}
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 bg-indigo-950/80 border border-indigo-700/60 hover:bg-indigo-900 text-indigo-300 hover:text-white disabled:opacity-40 rounded-xl transition-colors flex items-center space-x-1"
                title="Attach Document (.pdf, .docx)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={textInput}
                disabled={submissionStatus === 'submitted'}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  submissionStatus === 'submitted'
                    ? 'Form has already been submitted.'
                    : mode === 'editing' && activeEditingField
                    ? `Type updated ${activeEditingField.field_name.replace('_', ' ')}...`
                    : "Type response or 'accept all'..."
                }
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-500 disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={submissionStatus === 'submitted'}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: Live Form & Proposals Panel */}
        <div className="hidden lg:flex w-96 bg-[#022B3A] border border-[#1F7A8C]/40 rounded-3xl flex-col shadow-2xl p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1F7A8C]/30 pb-4">
            <div>
              <h3 className="font-bold text-[#FFFFFF] text-base">Live Form & Proposals</h3>
              <p className="text-xs text-[#E1E5F2]">
                {submissionStatus === 'submitted' ? 'Form submitted (read-only)' : 'Confirm extracted proposals or edit.'}
              </p>
            </div>
            <div className="px-2.5 py-1 bg-[#1F7A8C]/30 text-[#BFDBF7] border border-[#1F7A8C] rounded-lg text-xs font-mono font-bold">
              {Object.keys(answers).length} / {fields.length}
            </div>
          </div>

          {/* Document Proposals Section */}
          {proposals.length > 0 && submissionStatus !== 'submitted' && (
            <div className="p-4 rounded-2xl bg-indigo-950/70 border border-indigo-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Document Proposals ({proposals.length})</span>
                </span>

                {eligibleAcceptAllCount > 0 && (
                  <button
                    onClick={() => handleAcceptProposals(null)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg flex items-center space-x-1 shadow transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Accept All ({eligibleAcceptAllCount})</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {proposals.map((prop) => (
                  <div key={prop.id} className="p-3 bg-slate-900/90 border border-indigo-900/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-300">{prop.field_name?.replace('_', ' ')}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Page {prop.page || 1} • {prop.read_method}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-white bg-slate-950 p-2 rounded border border-slate-800">
                      {prop.value}
                    </p>

                    {/* Scanned Warning Badge */}
                    {prop.scanned_warning && (
                      <div className="p-1.5 bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[11px] rounded flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{prop.scanned_warning}</span>
                      </div>
                    )}

                    {/* Excluded from Accept All Note */}
                    {prop.is_excluded_from_accept_all && (
                      <p className="text-[10px] text-amber-400/80 italic font-mono">
                        *Scanned value: verify & accept individually.
                      </p>
                    )}

                    {/* Evidence / Quote */}
                    {prop.evidence && (
                      <p className="text-[11px] text-slate-400 italic">
                        "{prop.evidence}"
                      </p>
                    )}

                    {/* Alternative Choices */}
                    {prop.alternatives && prop.alternatives.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[10px] text-slate-400">Alts:</span>
                        {prop.alternatives.map((alt, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => {
                              setEditingProposal(prop);
                              setEditingProposalVal(alt);
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-indigo-900 text-indigo-300 text-[10px] rounded border border-slate-700"
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Proposal Action Buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => handleDismissProposal(prop.id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 text-xs rounded flex items-center space-x-1"
                        title="Dismiss proposal"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingProposal(prop);
                          setEditingProposalVal(prop.value);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded flex items-center space-x-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleAcceptProposals([prop.id])}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Fields List */}
          <div className="space-y-3 flex-1">
            {fields.map((field) => {
              const isCurrent = currentField?.id === field.id;
              const isEditingThis = mode === 'editing' && editingFieldId === field.id;
              const hasAnswer = answers[field.id] !== undefined && answers[field.id] !== null && String(answers[field.id]).trim() !== '';

              return (
                <div
                  key={field.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEditingThis
                      ? 'bg-[#1F7A8C]/50 border-[#BFDBF7] shadow-lg scale-[1.02]'
                      : isCurrent
                      ? 'bg-[#1F7A8C]/30 border-[#1F7A8C] shadow-lg'
                      : hasAnswer
                      ? 'bg-[#022B3A] border-[#1F7A8C]/40'
                      : 'bg-[#022B3A]/60 border-[#1F7A8C]/20 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#E1E5F2] flex items-center space-x-1.5">
                      <span>{field.field_name.replace('_', ' ')}</span>
                      {hasAnswer && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {field.data_type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold truncate max-w-[220px]">
                      {hasAnswer ? (
                        <span className={isEditingThis ? 'text-emerald-400/50 italic' : 'text-emerald-400'}>
                          {answers[field.id]} {isEditingThis && '(editing...)'}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-normal italic">Unfilled</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleGotoField(field.id)}
                      disabled={submissionStatus === 'submitted'}
                      className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 disabled:opacity-30 rounded transition-colors"
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
              disabled={submitting || mode === 'editing' || !allAnswered || submissionStatus === 'submitted'}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submissionStatus === 'submitted' ? (
                <>
                  <Lock className="w-4 h-4 text-emerald-300" />
                  <span>Submitted & Locked</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Submitting...' : 'Complete & Submit Form'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Proposal Value Modal */}
      {editingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleEditProposalSubmit} className="max-w-md w-full bg-slate-900 border border-indigo-900/80 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Edit Proposal Value</h3>
            <p className="text-xs text-indigo-300">Field: {editingProposal.field_name}</p>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-mono">Value</label>
              <input
                type="text"
                value={editingProposalVal}
                onChange={(e) => setEditingProposalVal(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingProposal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 shadow"
              >
                Save & Accept
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
