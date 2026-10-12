import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ReviewModal } from '../components/ReviewModal';
import { SubmissionSuccessModal } from '../components/SubmissionSuccessModal';
import { getTranslation } from '../i18n';
import {
  ArrowLeft, Upload, X, Code, ChevronUp, CheckCircle2, ArrowDown
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
  const { token, user } = useAuth();

  // Settings & Toggles
  const [uiLang, setUiLang] = useState('en');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Review & Success Modals
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Server State Truth
  const [currentField, setCurrentField] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [proposals, setProposals] = useState([]);
  const [mode, setMode] = useState('normal');
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [allAnswered, setAllAnswered] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('in_progress');
  const [formTitle, setFormTitle] = useState('Application Form');

  // Document Upload & Progress State
  const [docUploading, setDocUploading] = useState(false);
  const [docProgress, setDocProgress] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Notifications & Toast
  const [undoToast, setUndoToast] = useState(null);
  const [micError, setMicError] = useState(null);

  // Chat UI Messages & Input
  const [chatMessages, setChatMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Turn Timings
  const [latestTiming, setLatestTiming] = useState(null);

  const wsRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const submitTriggerRef = useRef(null);
  const hasAddedCompletedMsgRef = useRef(false);
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const t = useCallback((key, params) => getTranslation(uiLang, key, params), [uiLang]);

  // Handle Tamil voice fallback notice
  const handleTamilVoiceMissing = useCallback(() => {
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'system',
        text: getTranslation(uiLang, 'tts_ta_missing_notice'),
        lang: uiLang
      }
    ]);
  }, [uiLang]);

  const { speak, stop: stopSpeech, isSpeaking } = useSpeech(speechEnabled, handleTamilVoiceMissing);
  const silenceDurationMs = currentField ? VAD_SILENCE_CONFIG[currentField.data_type] || 600 : 600;

  const handleSpeechEnd = useCallback((wavBuffer) => {
    setUndoToast(null);
    setMicError(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(wavBuffer);
    }
  }, []);

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

  const promptFieldQuestionRef = useRef(null);
  const applyServerStateRef = useRef(null);
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  const stopSpeechRef = useRef(stopSpeech);
  useEffect(() => {
    stopSpeechRef.current = stopSpeech;
  }, [stopSpeech]);

  const startListeningRef = useRef(startListening);
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListeningRef = useRef(stopListening);
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  const uiLangRef = useRef(uiLang);
  useEffect(() => {
    uiLangRef.current = uiLang;
  }, [uiLang]);

  const handleMicTap = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset_mic' }));
    }
    setMicError(null);
    // Ensure TTS is stopped before listening
    stopSpeech();
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

  // Keyboard navigation & Shortcuts
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

  // Chat scroll observer
  const handleChatScroll = (e) => {
    const el = e.currentTarget;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsScrolledUp(!isNearBottom);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView?.({ behavior });
    setIsScrolledUp(false);
  };

  useEffect(() => {
    if (!isScrolledUp) {
      chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [chatMessages, isScrolledUp]);

  // Prompt field question
  const promptFieldQuestion = useCallback((fieldObj, language, isEditing = false, currentVal = null) => {
    if (!fieldObj) return;

    const lang = language || uiLangRef.current;
    let qText = fieldObj.question_en;
    let speakLang = 'en';
    if (lang === 'ta') {
      qText = fieldObj.question_ta || fieldObj.question_en;
      speakLang = 'ta';
    }

    if (isEditing) {
      const friendlyName = fieldObj.field_name.replace(/_/g, ' ');
      const intro = getTranslation(lang, 'edit_reask_intro', {
        field: friendlyName,
        currentValue: currentVal || '—'
      });
      qText = `${intro} ${qText}`;
    }

    setChatMessages((prev) => [
      ...prev,
      { sender: 'bot', text: qText, fieldName: fieldObj.field_name, fieldId: fieldObj.id, lang: speakLang }
    ]);

    // Ensure mic is stopped while assistant is speaking, start listening when done
    stopListeningRef.current?.();
    speakRef.current?.(qText, speakLang, () => {
      startListeningRef.current?.();
    });
  }, []);

  useEffect(() => {
    promptFieldQuestionRef.current = promptFieldQuestion;
  }, [promptFieldQuestion]);

  const applyServerState = useCallback((data) => {
    if (data.fields) setFields(data.fields);
    if ('current_field' in data) setCurrentField(data.current_field);
    if ('current_field_index' in data) setCurrentIndex(data.current_field_index);
    if ('mode' in data) setMode(data.mode);
    if ('editing_field_id' in data) setEditingFieldId(data.editing_field_id);
    if ('all_answered' in data) setAllAnswered(data.all_answered);
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
  }, []);

  useEffect(() => {
    applyServerStateRef.current = applyServerState;
  }, [applyServerState]);

  // Check completed state
  const answeredCount = fields.filter(
    (f) => answers[f.id] !== undefined && answers[f.id] !== null && String(answers[f.id]).trim() !== ''
  ).length;

  const isCompleted =
    (allAnswered || (fields.length > 0 && answeredCount >= fields.length) || mode === 'review') &&
    mode !== 'editing' &&
    submissionStatus !== 'submitted';

  // Add completion assistant message once upon entering completed state
  useEffect(() => {
    if (isCompleted && !hasAddedCompletedMsgRef.current && chatMessages.length > 0) {
      hasAddedCompletedMsgRef.current = true;
      const compMsg = getTranslation(uiLang, 'completed_stage_msg');
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'bot' && last.text === compMsg) {
          return prev;
        }
        return [...prev, { sender: 'bot', text: compMsg, lang: uiLang }];
      });
      stopListeningRef.current?.();
      speakRef.current?.(compMsg, uiLang);
    } else if (!isCompleted) {
      hasAddedCompletedMsgRef.current = false;
    }
  }, [isCompleted, uiLang, chatMessages.length]);

  // WebSocket Connection
  useEffect(() => {
    if (!submissionId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/submissions/${submissionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token, language_hint: uiLangRef.current }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const currentLang = uiLangRef.current;

      if (data.type === 'ready') {
        applyServerStateRef.current?.(data);
        if (data.submission_status === 'submitted') {
          setChatMessages([
            { sender: 'bot', text: getTranslation(currentLang, 'submitted_lock_msg') }
          ]);
        } else if (data.all_answered || data.mode === 'review') {
          setChatMessages([
            { sender: 'bot', text: getTranslation(currentLang, 'completed_stage_msg') }
          ]);
        } else if (data.current_field) {
          const title = data.form_title || 'your application form';
          setChatMessages([
            { sender: 'bot', text: getTranslation(currentLang, 'welcome_msg', { title }) }
          ]);
          promptFieldQuestionRef.current?.(data.current_field, currentLang);
        }
      }

      else if (data.type === 'document_status') {
        setDocProgress({ message: data.message, progress: data.progress });
        if (data.progress >= 100) {
          setTimeout(() => setDocProgress(null), 3000);
        }
      }

      else if (data.type === 'state_sync') {
        applyServerStateRef.current?.(data);
      }

      else if (data.type === 'transcript') {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'user', text: data.text, lang: data.language, isVoice: true }
        ]);
      }

      else if (data.type === 'drop_silent') {
        setLatestTiming(data.debug_info || null);
        setMicError('no_speech');
      }

      else if (data.type === 'mic_resumed') {
        applyServerStateRef.current?.(data);
      }

      else if (data.type === 'answer') {
        setLatestTiming(data.timing || null);
        applyServerStateRef.current?.(data);

        if (data.field_id) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.fieldId === data.field_id ? { ...m, replaced: true } : m
            )
          );

          const fieldObj = fieldsRef.current.find((f) => f.id === data.field_id);
          setUndoToast({
            fieldId: data.field_id,
            fieldName: fieldObj ? fieldObj.field_name.replace(/_/g, ' ') : 'field'
          });
          setTimeout(() => setUndoToast(null), 5000);
        }

        if (data.mode === 'review' || data.all_answered) {
          hasAddedCompletedMsgRef.current = true;
          const completionMsg = getTranslation(currentLang, 'completed_stage_msg');
          setChatMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'bot' && last.text === completionMsg) {
              return prev;
            }
            return [...prev, { sender: 'bot', text: completionMsg, lang: currentLang }];
          });
          speakRef.current?.(completionMsg, currentLang);
        } else if (data.current_field) {
          promptFieldQuestionRef.current?.(data.current_field, currentLang, data.mode === 'editing');
        }
      }

      else if (data.type === 'follow_up') {
        setLatestTiming(data.timing || null);
        applyServerStateRef.current?.(data);
        setChatMessages((prev) => [...prev, { sender: 'bot', text: data.text, lang: currentLang }]);
        stopListeningRef.current?.();
        speakRef.current?.(data.text, currentLang === 'ta' ? 'ta' : 'en', () => startListeningRef.current?.());
      }

      else if (data.type === 'navigate') {
        applyServerStateRef.current?.(data);
        if (data.text) {
          setChatMessages((prev) => [...prev, { sender: 'bot', text: data.text, lang: currentLang }]);
          stopListeningRef.current?.();
          speakRef.current?.(data.text, currentLang, () => startListeningRef.current?.());
        } else if (data.current_field) {
          const curVal = data.answers && data.answers[data.current_field.id]?.value;
          promptFieldQuestionRef.current?.(data.current_field, currentLang, data.mode === 'editing', curVal);
        }
      }

      else if (data.type === 'submitted') {
        applyServerStateRef.current?.(data);
        setSubmitting(false);
        setReviewModalOpen(false);
        setSuccessModalOpen(true);
        const submittedMsg = getTranslation(currentLang, 'submitted_success_msg');
        setChatMessages((prev) => [...prev, { sender: 'bot', text: submittedMsg, lang: currentLang }]);
        speakRef.current?.(submittedMsg, currentLang);
      }

      else if (data.type === 'error') {
        setSubmitting(false);
        setSubmitError(data.message);
        setChatMessages((prev) => [
          ...prev,
          { sender: 'bot', text: data.message, isError: true, lang: currentLang }
        ]);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [submissionId, token]);

  // Clean up speech and mic on unmount
  useEffect(() => {
    return () => {
      stopSpeechRef.current?.();
      stopListeningRef.current?.();
    };
  }, []);

  // Document upload handler
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
        { sender: 'bot', text: `Couldn't read document: ${err.message}. Please answer by voice or text.`, isError: true }
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

  // Field navigation / Edit
  const handleGotoField = (fieldId) => {
    if (submissionStatus === 'submitted') return;
    setReviewModalOpen(false);
    setDrawerOpen(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'goto', field_id: fieldId }));
    }

    scrollToBottom('smooth');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
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

  // Text message send
  const handleSendText = (e) => {
    e.preventDefault();
    if (!textInput.trim() || submissionStatus === 'submitted') return;

    const val = textInput.trim();
    setTextInput('');
    setUndoToast(null);
    setMicError(null);

    setChatMessages((prev) => [
      ...prev,
      { sender: 'user', text: val, fieldId: currentField?.id, isVoice: false }
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

  // Final submission confirmation handler
  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'submit' }));
      } else {
        const answersPayload = fields.map((f) => ({
          field_id: f.id,
          value: answers[f.id] || null,
          raw_transcript: answers[f.id] || null,
          language: uiLang
        }));
        const res = await userFormsApi.completeSubmission(submissionId, answersPayload);
        setSubmitting(false);
        setSubmissionStatus('submitted');
        setReviewModalOpen(false);
        setSuccessModalOpen(true);
      }
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err.message || 'Submission failed. Please check your answers and try again.');
    }
  };

  const activeEditingField = fields.find((f) => f.id === editingFieldId) || currentField;
  const isDev = import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
  const isAdmin = user && user.role === 'admin';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#EDEDE9] text-[#1C1917] flex flex-col h-screen overflow-hidden relative font-body"
    >
      <Navbar
        uiLang={uiLang}
        setUiLang={setUiLang}
        speechEnabled={speechEnabled}
        setSpeechEnabled={setSpeechEnabled}
      />

      <EmergencyNotice uiLang={uiLang} />

      <PrivacyNoticeModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      {/* Review & Confirm Step Modal */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        fields={fields}
        answers={answers}
        onEditField={handleGotoField}
        submitting={submitting}
        submitError={submitError}
        onRetry={handleConfirmSubmit}
        uiLang={uiLang}
        triggerRef={submitTriggerRef}
      />

      {/* Submission Success Modal */}
      <SubmissionSuccessModal
        isOpen={successModalOpen}
        formTitle={formTitle}
        uiLang={uiLang}
      />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#F5EBE0]/95 flex flex-col items-center justify-center border-4 border-dashed border-[#1F3FBF] pointer-events-none">
          <Upload className="w-16 h-16 text-[#1F3FBF] mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold font-display text-[#1C1917]">Drop document to upload</h2>
          <p className="text-sm text-[#524E4A] mt-1">Only .pdf and .docx files are accepted</p>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 flex gap-6 overflow-hidden">
        {/* LEFT COLUMN: Conversation Thread & Controls */}
        <div className="flex-1 bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl sheet-shadow flex flex-col overflow-hidden relative">
          {/* Single Form Header without duplicated title */}
          <div className="p-4 sm:p-5 border-b border-[#D6CCC2] flex items-center justify-between bg-[#F5EBE0] shrink-0">
            <div className="flex items-center space-x-3">
              <Link
                to="/user"
                className="p-2 text-[#524E4A] hover:text-[#1C1917] hover:bg-[#E3D5CA] rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                aria-label={t('btn_back_to_forms')}
                title={t('btn_back_to_forms')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl font-bold font-display text-[#1C1917] tracking-tight truncate max-w-[280px] sm:max-w-md">
                  {formTitle}
                </h1>
                <p className="text-sm text-[#524E4A] font-body">
                  {submissionStatus === 'submitted'
                    ? t('submitted_lock_msg')
                    : mode === 'editing' && activeEditingField
                      ? `${t('sheet_editing')}: ${activeEditingField.field_name.replace(/_/g, ' ')}`
                      : isCompleted
                        ? t('chat_status_all_answered')
                        : currentField
                          ? t('chat_status_progress', { current: currentIndex + 1, total: fields.length })
                          : t('appName')}
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
              {submissionStatus !== 'submitted' && !isCompleted && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={docUploading}
                  className="px-3.5 py-2 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] text-sm font-semibold rounded-md flex items-center space-x-2 transition-colors cursor-pointer min-h-[44px]"
                  title="Upload supporting document"
                >
                  <Upload className="w-4 h-4 text-[#1F3FBF]" />
                  <span className="hidden sm:inline">Upload document</span>
                </button>
              )}

              {/* Developer <> icon: Hidden for citizens; shown only for admin or debug flag */}
              {(isAdmin || (isDev && new URLSearchParams(window.location.search).get('debug') === '1')) && (
                <button
                  type="button"
                  onClick={() => setDebugPanelOpen(!debugPanelOpen)}
                  className="p-2.5 text-[#524E4A] hover:text-[#1F3FBF] rounded-md text-sm font-mono cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                  title="Toggle developer debug panel"
                  aria-label="Toggle debug panel"
                >
                  <Code className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Field Edit Banner */}
          {mode === 'editing' && activeEditingField && (
            <div className="p-3 bg-[#E3D5CA]/50 border-b border-[#D6CCC2] shrink-0">
              <EditBanner
                fieldName={activeEditingField.field_name}
                onCancel={handleCancelEditing}
                uiLang={uiLang}
              />
            </div>
          )}

          {/* Undo Toast */}
          {undoToast && (
            <div className="px-4 pt-3 shrink-0">
              <Toast
                message={`Updated ${undoToast.fieldName}.`}
                onUndo={handleUndo}
                uiLang={uiLang}
              />
            </div>
          )}

          {/* Chat Messages Log */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-8"
          >
            {chatMessages.map((msg, idx) => (
              <ConversationMessage
                key={idx}
                message={msg}
                onRetryVoice={() => handleMicTap()}
              />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Jump to latest floating button */}
          {isScrolledUp && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-24 right-6 z-20 px-4 py-2 bg-[#1C1917] text-[#F5EBE0] text-sm font-semibold rounded-full shadow-lg flex items-center space-x-1.5 hover:bg-[#1C1917]/90 transition-all cursor-pointer min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
              aria-label={t('chat_jump_latest')}
            >
              <span>{t('chat_jump_latest')}</span>
              <ArrowDown className="w-4 h-4" />
            </button>
          )}

          {/* Action Area: Completed Bar OR Voice & Text Composer */}
          <div className="p-4 sm:p-5 border-t border-[#D6CCC2] bg-[#F5EBE0] shrink-0 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {isCompleted ? (
              /* Compact Completion Bar: replaces mic & live input when all answered */
              <div className="bg-[#E3D5CA]/70 border border-[#D6CCC2] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-full bg-[#15803D]/10 text-[#15803D] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1C1917] font-body leading-tight">
                      {t('completed_status_title')}
                    </h2>
                    <p className="text-sm text-[#524E4A] font-body mt-0.5">
                      {t('completed_status_desc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                  <button
                    ref={submitTriggerRef}
                    type="button"
                    onClick={() => setReviewModalOpen(true)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-base rounded-lg transition-colors cursor-pointer min-h-[48px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                  >
                    {t('btn_review_and_submit')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (fields.length > 0) {
                        handleGotoField(fields[0].id);
                      }
                    }}
                    className="flex-1 sm:flex-none px-4 py-3 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors cursor-pointer min-h-[48px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                  >
                    {t('btn_change_answer')}
                  </button>
                </div>
              </div>
            ) : (
              /* Composer Area: 64px Mic, Text Input, and Send Button on one row at desktop */
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  {/* Single Row at desktop: MicControl + Form Input */}
                  <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full">
                    <MicControl
                      vadState={vadState}
                      isListening={isListening}
                      permissionState={permissionState}
                      micError={micError}
                      isDisabled={submissionStatus === 'submitted'}
                      onTapMic={handleMicTap}
                      onRetryMic={handleMicTap}
                      uiLang={uiLang}
                    />

                    {/* Text Input & Send */}
                    {submissionStatus !== 'submitted' && (
                      <form onSubmit={handleSendText} className="flex-1 flex items-center gap-2 w-full">
                        <input
                          ref={inputRef}
                          type="text"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder={t('type_placeholder')}
                          className="flex-1 h-12 bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg px-4 text-base text-[#1C1917] placeholder:text-[#524E4A] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                        />
                        <button
                          type="submit"
                          disabled={!textInput.trim() || submissionStatus === 'submitted'}
                          className="h-12 px-6 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg transition-colors disabled:bg-[#D6CCC2] disabled:text-[#524E4A] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                        >
                          {t('btn_send')}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Mobile Drawer Toggle */}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="lg:hidden w-full sm:w-auto py-2.5 px-3.5 border border-[#D6CCC2] bg-[#F5EBE0] hover:bg-[#E3D5CA] rounded-lg text-sm text-[#1C1917] font-semibold flex items-center justify-between space-x-3 min-h-[44px]"
                  >
                    <span>{t('panel_title_answers')}</span>
                    <span className="text-[#1F3FBF] flex items-center space-x-1 font-medium">
                      <span>{t('sheet_progress', { answered: answeredCount, total: fields.length })}</span>
                      <ChevronUp className="w-4 h-4 ml-1" />
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: The Side Panel (Desktop Only) */}
        <div className="hidden lg:block w-[380px] xl:w-[420px] shrink-0 h-full">
          <Sheet
            fields={fields}
            answers={answers}
            currentFieldId={currentField?.id}
            editingFieldId={editingFieldId}
            mode={mode}
            allAnswered={allAnswered}
            submissionStatus={submissionStatus}
            submitting={submitting}
            onSubmit={() => setReviewModalOpen(true)}
            onGotoField={handleGotoField}
            uiLang={uiLang}
          />
        </div>
      </div>

      {/* Mobile Answers Bottom Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('panel_title_answers')}
      >
        <div className="h-[65dvh]">
          <Sheet
            fields={fields}
            answers={answers}
            currentFieldId={currentField?.id}
            editingFieldId={editingFieldId}
            mode={mode}
            allAnswered={allAnswered}
            submissionStatus={submissionStatus}
            submitting={submitting}
            onSubmit={() => {
              setDrawerOpen(false);
              setReviewModalOpen(true);
            }}
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
        <div className="fixed bottom-0 right-0 w-96 max-h-80 bg-[#1C1917] text-[#F5EBE0] p-4 font-mono text-xs overflow-y-auto z-50 border-t-2 border-[#1F3FBF] shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-[#F5EBE0]/20 mb-2">
            <span className="font-bold text-[#E3D5CA]">DEBUG PANEL</span>
            <button onClick={() => setDebugPanelOpen(false)} className="text-white hover:text-[#E3D5CA] cursor-pointer">
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
