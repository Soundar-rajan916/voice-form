import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userFormsApi } from '../api/client';
import { useVad } from '../hooks/useVad';
import { useSpeech } from '../hooks/useSpeech';
import { Navbar } from '../components/Navbar';
import { EmergencyNotice } from '../components/EmergencyNotice';
import { Sheet } from '../components/Sheet';
import { MicControl } from '../components/MicControl';
import { ConversationMessage } from '../components/ConversationMessage';
import { PrivacyNoticeModal } from '../components/PrivacyNoticeModal';
import { Toast } from '../components/Toast';
import { EditBanner } from '../components/EditBanner';
import { Drawer } from '../components/Drawer';
import { brandConfig } from '../brand';
import {
  ArrowLeft, Upload, X, Code, ChevronUp
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

  // Settings & Toggles
  const [uiLang, setUiLang] = useState('en');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const [formTitle, setFormTitle] = useState('Intake Form');

  // Document Upload & Progress State
  const [docUploading, setDocUploading] = useState(false);
  const [docProgress, setDocProgress] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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
    const isDev = import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
    const handleKeyDown = (e) => {
      if (isDev && e.ctrlKey && e.shiftKey && e.key === 'D') {
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
      const friendlyName = fieldObj.field_name.replace(/_/g, ' ');
      qText = `Let's change your ${friendlyName}. ${qText}`;
    }

    setChatMessages((prev) => [
      ...prev,
      { sender: 'bot', text: qText, fieldName: fieldObj.field_name, fieldId: fieldObj.id, lang: speakLang }
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
    if (data.form_title) setFormTitle(data.form_title);

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
            { sender: 'bot', text: 'This form has been submitted and is locked.' }
          ]);
        } else if (data.all_answered || data.mode === 'review') {
          setChatMessages([
            { sender: 'bot', text: 'All questions answered. Check your answers, change anything, then submit.' }
          ]);
        } else if (data.current_field) {
          const title = data.form_title || 'your intake form';
          setChatMessages([
            { sender: 'bot', text: `Hello. I'll help you fill in ${title}. I'll ask one question at a time. You can speak or type, and you can change any answer before you submit.` }
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
            fieldName: fieldObj ? fieldObj.field_name.replace(/_/g, ' ') : 'field'
          });
          setTimeout(() => setUndoToast(null), 5000);
        }

        if (data.mode === 'review' || data.all_answered) {
          const completionMsg = 'All questions answered. Check your answers, change anything, then submit.';
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
        const submittedMsg = `Form submitted. Your answers have been sent to ${brandConfig.hospitalName}.`;
        setChatMessages((prev) => [...prev, { sender: 'bot', text: submittedMsg }]);
        speak(submittedMsg, 'en');
      }

      else if (data.type === 'error') {
        setSubmitting(false);
        setChatMessages((prev) => [
          ...prev,
          { sender: 'bot', text: data.message, isError: true }
        ]);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
      stopSpeech();
      stopListening();
    };
  }, [submissionId, token]);

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
    setDocProgress({ message: 'Reading document...', progress: 10 });

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
        { sender: 'system', text: data.message || 'Extracted answers from document.' }
      ]);
      if (data.proposals) {
        setProposals(data.proposals);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `Couldn't read document: ${err.message}. Please check your file or answer by voice or text.`, isError: true }
      ]);
    } finally {
      setDocUploading(false);
    }
  };

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

  const handleGotoField = (fieldId) => {
    if (submissionStatus === 'submitted') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'goto', field_id: fieldId }));
      inputRef.current?.focus();
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
  const isDev = import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
  const answeredCount = fields.filter(f => answers[f.id] !== undefined && answers[f.id] !== null && String(answers[f.id]).trim() !== '').length;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#DCE7E0] text-[#2A2E2C] flex flex-col h-screen overflow-hidden relative font-sans-ui"
    >
      <Navbar
        uiLang={uiLang}
        setUiLang={setUiLang}
        speechEnabled={speechEnabled}
        setSpeechEnabled={setSpeechEnabled}
      />

      <EmergencyNotice />

      <PrivacyNoticeModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#F6F8F5]/90 flex flex-col items-center justify-center border-4 border-dashed border-[#1F3FBF] pointer-events-none">
          <Upload className="w-16 h-16 text-[#1F3FBF] mb-4" />
          <h2 className="text-2xl font-bold font-serif text-[#2A2E2C]">Drop document to upload</h2>
          <p className="text-sm text-[#2A2E2C]/75 mt-1">Only .pdf and .docx files are accepted</p>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex gap-6 overflow-hidden">
        {/* LEFT COLUMN: Conversation Thread & Controls */}
        <div className="flex-1 bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg sheet-shadow flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="p-4 border-b border-[#DCE7E0] flex items-center justify-between bg-[#F6F8F5]">
            <div className="flex items-center space-x-3">
              <Link
                to="/user"
                className="p-2 text-[#2A2E2C]/75 hover:text-[#2A2E2C] rounded transition-colors focus:ring-2 focus:ring-[#1F3FBF]"
                aria-label="Back to forms"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h2 className="text-base font-bold font-serif text-[#2A2E2C]">
                  {formTitle}
                </h2>
                <p className="text-xs text-[#2A2E2C]/75">
                  {submissionStatus === 'submitted'
                    ? 'Form submitted and locked'
                    : mode === 'editing'
                    ? `Editing: ${activeEditingField?.field_name.replace(/_/g, ' ')}`
                    : allAnswered
                    ? 'All questions answered'
                    : currentField
                    ? `Question: ${currentField.field_name.replace(/_/g, ' ')}`
                    : 'Intake session'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleUploadFile(e.target.files[0])}
                accept=".pdf,.docx"
                className="hidden"
              />
              {submissionStatus !== 'submitted' && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={docUploading}
                  className="px-3 py-1.5 border border-[#DCE7E0] hover:bg-[#DCE7E0]/50 text-[#2A2E2C] text-xs font-semibold rounded flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="Upload patient record or document"
                >
                  <Upload className="w-3.5 h-3.5 text-[#1F3FBF]" />
                  <span className="hidden sm:inline">Upload document</span>
                </button>
              )}

              {isDev && (
                <button
                  type="button"
                  onClick={() => setDebugPanelOpen(!debugPanelOpen)}
                  className="p-2 text-[#2A2E2C]/75 hover:text-[#1F3FBF] rounded text-xs font-mono"
                  title="Toggle debug panel"
                >
                  <Code className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Edit Banner */}
          {mode === 'editing' && activeEditingField && (
            <div className="p-2 px-4 bg-[#FFE45C] border-b border-[#DCE7E0]">
              <EditBanner
                fieldName={activeEditingField.field_name}
                onCancel={handleCancelEditing}
                uiLang={uiLang}
              />
            </div>
          )}

          {/* Undo Toast */}
          {undoToast && (
            <div className="px-4 pt-2">
              <Toast
                message={`Updated ${undoToast.fieldName}.`}
                onUndo={handleUndo}
                uiLang={uiLang}
              />
            </div>
          )}

          {/* Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <ConversationMessage key={idx} message={msg} />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Mic & Text Input Action Area */}
          <div className="p-4 border-t border-[#DCE7E0] bg-[#F6F8F5] space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <MicControl
                vadState={vadState}
                isListening={isListening}
                permissionState={permissionState}
                isDisabled={submissionStatus === 'submitted'}
                onTapMic={handleMicTap}
                uiLang={uiLang}
              />

              {/* Mobile Drawer Toggle */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden w-full sm:w-auto py-2 px-3 border border-[#DCE7E0] rounded text-xs text-[#2A2E2C] font-semibold flex items-center justify-between space-x-2"
              >
                <span>{currentField ? currentField.field_name.replace(/_/g, ' ') : 'Sheet'}</span>
                <span className="text-[#1F3FBF] flex items-center space-x-1">
                  <span>{answeredCount} of {fields.length} answered</span>
                  <ChevronUp className="w-4 h-4" />
                </span>
              </button>
            </div>

            {/* Text Input Fallback */}
            {submissionStatus !== 'submitted' && (
              <form onSubmit={handleSendText} className="flex items-center space-x-2 pt-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your answer..."
                  className="flex-1 bg-[#F6F8F5] border border-[#DCE7E0] rounded px-4 py-2.5 text-sm text-[#2A2E2C] focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="px-4 py-2.5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] font-semibold text-sm rounded transition-colors disabled:opacity-40 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: The Sheet (Desktop Only) */}
        <div className="hidden lg:block w-[380px] xl:w-[420px] shrink-0 h-full">
          <Sheet
            formTitle={formTitle}
            fields={fields}
            answers={answers}
            currentFieldId={currentField?.id}
            editingFieldId={editingFieldId}
            mode={mode}
            allAnswered={allAnswered}
            submissionStatus={submissionStatus}
            submitting={submitting}
            onSubmit={handleCompleteSubmission}
            onGotoField={handleGotoField}
            uiLang={uiLang}
          />
        </div>
      </div>

      {/* Mobile Sheet Bottom Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`${formTitle} - Slip`}
      >
        <div className="h-[60dvh]">
          <Sheet
            formTitle={formTitle}
            fields={fields}
            answers={answers}
            currentFieldId={currentField?.id}
            editingFieldId={editingFieldId}
            mode={mode}
            allAnswered={allAnswered}
            submissionStatus={submissionStatus}
            submitting={submitting}
            onSubmit={handleCompleteSubmission}
            onGotoField={(fId) => {
              handleGotoField(fId);
              setDrawerOpen(false);
            }}
            uiLang={uiLang}
          />
        </div>
      </Drawer>

      {/* Debug Panel (Only when DEV or ?debug=1) */}
      {isDev && debugPanelOpen && (
        <div className="fixed bottom-0 right-0 w-96 max-h-80 bg-[#2A2E2C] text-[#F6F8F5] p-4 font-mono text-xs overflow-y-auto z-50 border-t-2 border-[#1F3FBF] shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-[#F6F8F5]/20 mb-2">
            <span className="font-bold text-[#FFE45C]">DEBUG PANEL</span>
            <button onClick={() => setDebugPanelOpen(false)} className="text-white hover:text-[#FFE45C]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            <p>Submission ID: {submissionId}</p>
            <p>VAD State: {vadState}</p>
            <p>Permission: {permissionState}</p>
            <p>Mode: {mode}</p>
            <p>Current Field: {currentField?.field_name || 'None'}</p>
            <p>All Answered: {String(allAnswered)}</p>
            <p>Latest Latency: {latestTiming ? JSON.stringify(latestTiming) : 'N/A'}</p>
          </div>
        </div>
      )}
    </div>
  );
};
