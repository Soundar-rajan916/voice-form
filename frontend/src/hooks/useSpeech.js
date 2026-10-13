import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeech = (enabled = true, onTamilVoiceMissing = null) => {
  const [voices, setVoices] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const warnedMissingTamilRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const hasTamilVoice = voices.some((v) => v.lang && v.lang.toLowerCase().startsWith('ta'));

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text, lang = 'en', onEnd) => {
      stop(); // Clear any ongoing speech & fallback timeouts

      if (!enabled || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (onEnd) onEnd();
        return;
      }

      // Check for Tamil voice availability fallback
      if (lang === 'ta') {
        const tamilVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ta'));
        if (!tamilVoice) {
          if (!warnedMissingTamilRef.current && onTamilVoiceMissing) {
            warnedMissingTamilRef.current = true;
            onTamilVoiceMissing();
          }
          if (onEnd) onEnd();
          return;
        }
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      let targetLang = lang === 'ta' ? 'ta-IN' : 'en-IN';
      let selectedVoice = voices.find(
        (v) => v.lang === targetLang || (v.lang && v.lang.startsWith(lang))
      );

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
      }

      const finishSpeech = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsSpeaking(false);
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 30);
      };

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = finishSpeech;
      utterance.onerror = finishSpeech;

      // Fallback timeout to prevent mic flag from getting stuck if onend never fires
      const maxDurationMs = Math.min(12000, Math.max(3500, text.length * 120));
      timeoutRef.current = setTimeout(() => {
        stop();
        if (onEnd) onEnd();
      }, maxDurationMs);

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finishSpeech();
      }
    },
    [enabled, voices, stop, onTamilVoiceMissing]
  );

  return { speak, stop, isSpeaking, voices, hasTamilVoice };
};
