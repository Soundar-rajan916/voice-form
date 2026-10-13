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
import { brandConfig } from '../brand';
import {
  ArrowLeft, Upload, X, Code, ChevronUp, CheckCircle2, ArrowDown, Loader2
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

  const isSubmitted = submissionStatus === 'submitted' || submissionStatus === 'completed';

  // Document Upload & Progress State
  const [docUploading, setDocUploading] = useState(false);
  const [docProgress, setDocProgress] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [editingProposal, setEditingProposal] = useState(null);
  const [editingProposalVal, setEditingProposalVal] = useState('');
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
    disabled: isSpeaking || isSubmitted
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
        updatedAns[fId] = (typeof aObj === 'object' && aObj !== null) ? aObj.value : aObj;
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
    !isSubmitted;

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

        if (data.submission_status === 'submitted' || data.submission_status === 'completed') {
          setChatMessages([]);
          stopSpeechRef.current?.();
          stopListeningRef.current?.();
          return;
        }

        const initialMessages = [];
        const fieldsList = data.fields || [];
        const answersMap = data.answers || {};

        // Reconstruct conversation history from answered fields in position order
        fieldsList.forEach((f) => {
          const ansEntry = answersMap[f.id];
          const hasVal =
            ansEntry &&
            ((typeof ansEntry === 'object' &&
              ansEntry.value !== null &&
              ansEntry.value !== undefined &&
              String(ansEntry.value).trim() !== '') ||
              (typeof ansEntry !== 'object' && String(ansEntry).trim() !== ''));

          if (hasVal) {
            const qText =
              currentLang === 'ta' && f.question_ta ? f.question_ta : (f.question_en || f.field_name);
            initialMessages.push({
              sender: 'bot',
              text: qText,
              fieldName: f.field_name,
              fieldId: f.id,
              lang: currentLang === 'ta' ? 'ta' : 'en'
            });

            const ansVal = typeof ansEntry === 'object' ? (ansEntry.raw_transcript || ansEntry.value) : ansEntry;
            const isVoice = typeof ansEntry === 'object' ? ansEntry.source === 'voice' : false;
            const userLang = typeof ansEntry === 'object' && ansEntry.language ? ansEntry.language : currentLang;
            initialMessages.push({
              sender: 'user',
              text: String(ansVal),
              fieldName: f.field_name,
              fieldId: f.id,
              isVoice: isVoice,
              lang: userLang
            });
          }
        });

        if (data.all_answered || data.mode === 'review') {
          hasAddedCompletedMsgRef.current = true;
          initialMessages.push({
            sender: 'bot',
            text: getTranslation(currentLang, 'completed_stage_msg'),
            lang: currentLang
          });
          setChatMessages(initialMessages);
        } else if (data.current_field) {
          if (initialMessages.length === 0) {
            const title = data.form_title || 'your application form';
            initialMessages.push({
              sender: 'bot',
              text: getTranslation(currentLang, 'welcome_msg', { title }),
              lang: currentLang
            });
          }
          setChatMessages(initialMessages);
          promptFieldQuestionRef.current?.(data.current_field, currentLang);
        } else {
          setChatMessages(initialMessages);
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
        setChatMessages([]);
        stopSpeechRef.current?.();
        stopListeningRef.current?.();
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

  // Proposal Actions via WebSocket
  const handleAcceptProposals = useCallback((proposalIds = null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'accept_proposals',
        proposal_ids: proposalIds
      }));
    }
  }, []);

  const handleDismissProposal = useCallback((proposalId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'dismiss_proposal',
        proposal_id: proposalId
      }));
    }
  }, []);

  const handleSaveEditedProposal = useCallback((proposalId, newVal) => {
    if (!newVal || !newVal.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'edit_proposal',
        proposal_id: proposalId,
        new_value: newVal.trim()
      }));
    }
    setEditingProposal(null);
    setEditingProposalVal('');
  }, []);

  // Document upload handler
  const handleUploadFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
    if (!allowed.includes(ext)) {
      alert('Accepted file formats: .pdf, .docx, .jpg, .png, .webp');
      return;
    }

    const acceptedPrivacy = localStorage.getItem('voiceform_privacy_accepted');
    if (!acceptedPrivacy) {
      setPendingUploadFile(file);
      setPrivacyModalOpen(true);
      return;
    }

    setDocUploading(true);
    setDocProgress({ message: 'Reading document...', progress: 10 });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
      const res = await fetch(`${apiBase}/submissions/${submissionId}/documents`, {
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

      if (data.proposals && data.proposals.length > 0) {
        setProposals(data.proposals);
        const count = data.proposals.length;
        const plural = count > 1 ? 's' : '';
        const botMsg = getTranslation(uiLang, 'proposals_extracted_msg', { count, plural });
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: botMsg,
            lang: uiLang,
            onAcceptAll: () => handleAcceptProposals(data.proposals.map((p) => p.id))
          }
        ]);
        speak(botMsg, uiLang);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'system', text: data.message || 'Read document, but no matching form answers were found.' }
        ]);
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

  const handleAcceptPrivacy = useCallback(() => {
    localStorage.setItem('voiceform_privacy_accepted', 'true');
    setPrivacyModalOpen(false);
    if (pendingUploadFile) {
      const fileToUpload = pendingUploadFile;
      setPendingUploadFile(null);
      handleUploadFile(fileToUpload);
    }
  }, [pendingUploadFile]);

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
      className={`min-h-screen bg-[#EDEDE9] text-[#1C1917] flex flex-col relative font-body ${isSubmitted ? 'overflow-y-auto' : 'h-screen overflow-hidden'
        }`}
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
        onAccept={handleAcceptPrivacy}
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
      {isSubmitted ? (
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col">
          {/* Header Card */}
          <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl sheet-shadow p-5 sm:p-6 mb-4 sm:mb-6 shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#D6CCC2]">
              <div className="flex items-center space-x-3">
                <Link
                  to="/user#my-submissions"
                  className="p-2 text-[#524E4A] hover:text-[#1C1917] hover:bg-[#E3D5CA] rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                  aria-label={t('btn_back_to_forms')}
                  title={t('btn_back_to_forms')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1C1917] tracking-tight">
                    {formTitle}
                  </h1>
                  <p className="text-sm text-[#524E4A] font-body">
                    {brandConfig.officeName || 'Citizen Service Centre'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-[#15803D]/10 text-[#15803D] border border-[#15803D]/20">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {t('stamp_submitted') || 'SUBMITTED'}
                </span>
              </div>
            </div>

            {/* Official Notice Banner */}
            <div className="mt-4 p-4 bg-[#E3D5CA]/50 border border-[#D6CCC2] rounded-lg flex items-start space-x-3 text-sm text-[#1C1917]">
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm sm:text-base text-[#1C1917]">
                  {t('submitted_lock_msg')}
                </p>
                <p className="text-xs text-[#524E4A] mt-1">
                  Submission ID #{submissionId} • Read-only ledger
                </p>
              </div>
            </div>
          </div>

          {/* Form Answers Table - Clean, Official Read-Only Ledger */}
          <div className="bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl sheet-shadow overflow-hidden mb-6">
            <div className="p-4 sm:p-5 border-b border-[#D6CCC2] bg-[#F5EBE0] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-display text-[#1C1917]">
                  {t('panel_title_answers') || 'Submitted Application Details'}
                </h2>
                <p className="text-xs sm:text-sm text-[#524E4A] font-body mt-0.5">
                  {t('sheet_progress', { answered: answeredCount, total: fields.length })}
                </p>
              </div>
              <span className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded bg-[#15803D]/10 text-[#15803D]">
                100% Completed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse font-body" role="table">
                <thead>
                  <tr className="bg-[#D6CCC2]/70 text-[#1C1917] font-semibold border-b border-[#D6CCC2]">
                    <th scope="col" className="py-3 px-4 w-12 text-center text-xs uppercase tracking-wider text-[#524E4A]">#</th>
                    <th scope="col" className="py-3 px-4 sm:px-6 text-xs uppercase tracking-wider text-[#524E4A]">Field & Question</th>
                    <th scope="col" className="py-3 px-4 sm:px-6 text-xs uppercase tracking-wider text-[#524E4A]">Submitted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6CCC2]">
                  {fields.map((field, idx) => {
                    const rawVal = answers[field.id];
                    let displayVal = '—';
                    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                      if (typeof rawVal === 'boolean') {
                        displayVal = rawVal ? 'Yes' : 'No';
                      } else {
                        displayVal = String(rawVal);
                      }
                    }

                    const qText = uiLang === 'ta' && field.question_ta
                      ? field.question_ta
                      : (field.question_en || field.field_name);

                    const fieldFriendlyName = (field.field_name || `Field ${idx + 1}`).replace(/_/g, ' ');

                    return (
                      <tr key={field.id} className="hover:bg-[#E3D5CA]/30 transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-[#524E4A] align-top">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 align-top">
                          <div className="text-xs font-bold uppercase tracking-wider text-[#524E4A] mb-1 font-body">
                            {fieldFriendlyName}
                          </div>
                          <div className="text-sm text-[#1C1917] font-medium leading-relaxed">
                            {qText}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 align-top font-medium text-sm sm:text-base text-[#1C1917] bg-[#E3D5CA]/10">
                          {displayVal === '—' ? (
                            <span className="text-[#524E4A] italic">—</span>
                          ) : (
                            <span className="font-semibold text-[#1C1917] break-words">
                              {displayVal}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official Certification Footer inside the card */}
            <div className="p-4 bg-[#E3D5CA]/40 border-t border-[#D6CCC2] flex flex-col sm:flex-row items-center justify-between text-xs text-[#524E4A] gap-2">
              <span>{brandConfig.officeName || 'Citizen Service Centre'} • Official Record</span>
              <span>Submission ID #{submissionId}</span>
            </div>
          </div>

          {/* Quick Nav Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pb-8 shrink-0">
            <Link
              to="/user"
              className="w-full sm:w-auto px-6 py-3 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center min-h-[44px]"
            >
              {t('btn_back_to_forms') || 'Start Another Form'}
            </Link>
          </div>
        </div>
      ) : (
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
                    {mode === 'editing' && activeEditingField
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
                  accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                />
                {!isCompleted && (
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

            {/* Real-time Document Reading Progress */}
            {docProgress && (
              <div className="p-3 bg-[#E3D5CA]/90 border-b border-[#D6CCC2] flex items-center justify-between text-xs font-body text-[#1C1917] shrink-0">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1F3FBF]" />
                  <span className="font-semibold">{docProgress.message || 'Processing document...'}</span>
                </div>
                <span className="font-mono text-[#524E4A]">{docProgress.progress || 0}%</span>
              </div>
            )}

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
                        isDisabled={false}
                        onTapMic={handleMicTap}
                        onRetryMic={handleMicTap}
                        uiLang={uiLang}
                      />

                      {/* Text Input & Send */}
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
                          disabled={!textInput.trim()}
                          className="h-12 px-6 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg transition-colors disabled:bg-[#D6CCC2] disabled:text-[#524E4A] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                        >
                          {t('btn_send')}
                        </button>
                      </form>
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
              proposals={proposals}
              currentFieldId={currentField?.id}
              editingFieldId={editingFieldId}
              mode={mode}
              allAnswered={allAnswered}
              submissionStatus={submissionStatus}
              submitting={submitting}
              onSubmit={() => setReviewModalOpen(true)}
              onGotoField={handleGotoField}
              onAcceptProposals={handleAcceptProposals}
              onDismissProposal={handleDismissProposal}
              onEditProposal={(prop) => {
                setEditingProposal(prop);
                setEditingProposalVal(prop.value || '');
              }}
              uiLang={uiLang}
            />
          </div>
        </div>
      )}

      {/* Mobile Answers Bottom Drawer */}
      {!isSubmitted && (
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('panel_title_answers')}
        >
          <div className="h-[65dvh]">
            <Sheet
              fields={fields}
              answers={answers}
              proposals={proposals}
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
              onAcceptProposals={handleAcceptProposals}
              onDismissProposal={handleDismissProposal}
              onEditProposal={(prop) => {
                setEditingProposal(prop);
                setEditingProposalVal(prop.value || '');
              }}
              uiLang={uiLang}
            />
          </div>
        </Drawer>
      )}

      {/* Edit Proposal Value Modal */}
      {editingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs">
          <div className="max-w-md w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl p-6 sheet-shadow text-[#1C1917] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D6CCC2]">
              <h3 className="text-lg font-bold font-display text-[#1C1917]">
                {t('proposals_edit_modal_title')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProposal(null)}
                className="p-1 text-[#524E4A] hover:text-[#1C1917] rounded-md transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#524E4A] font-body">
              Field: <span className="font-semibold text-[#1C1917] capitalize">{(editingProposal.field_name || '').replace(/_/g, ' ')}</span>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditedProposal(editingProposal.id, editingProposalVal);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={editingProposalVal}
                onChange={(e) => setEditingProposalVal(e.target.value)}
                autoFocus
                className="w-full h-11 bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg px-3.5 text-base text-[#1C1917] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
              />

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProposal(null)}
                  className="px-4 py-2 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] rounded-lg text-sm font-semibold transition-colors cursor-pointer min-h-[40px]"
                >
                  {t('edit_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!editingProposalVal.trim()}
                  className="px-4 py-2 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer min-h-[40px] disabled:opacity-50"
                >
                  {t('proposals_save_accept')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
