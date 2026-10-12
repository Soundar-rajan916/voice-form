import { useState, useEffect, useRef, useCallback } from 'react';

// Helper to encode Float32Array PCM samples to 16kHz Mono WAV binary ArrayBuffer
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const useVad = ({ onSpeechEnd, silenceDurationMs = 600, disabled = false }) => {
  const [vadState, setVadState] = useState('idle'); // 'idle' | 'listening' | 'speech_detected' | 'processing'
  const [isListening, setIsListening] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'granted' | 'denied' | 'prompt' | 'error'
  const [errorDetails, setErrorDetails] = useState(null);

  const vadRef = useRef(null);
  const isInitializingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const onSpeechEndRef = useRef(onSpeechEnd);
  useEffect(() => {
    onSpeechEndRef.current = onSpeechEnd;
  }, [onSpeechEnd]);

  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled && isListening) {
      stopListening();
    }
  }, [disabled, isListening]);

  const silenceDurationMsRef = useRef(silenceDurationMs);
  useEffect(() => {
    silenceDurationMsRef.current = silenceDurationMs;
  }, [silenceDurationMs]);

  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Check microphone permissions
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' })
        .then((res) => {
          setPermissionState(res.state);
          res.onchange = () => setPermissionState(res.state);
        })
        .catch(() => {});
    }
  }, []);

  const stopListening = useCallback(async () => {
    // 1. Stop VAD instance if running
    if (vadRef.current) {
      try {
        await vadRef.current.pause();
        await vadRef.current.destroy();
      } catch (err) {
        console.error('Error destroying VAD:', err);
      }
      vadRef.current = null;
    }

    // 2. Stop Manual MediaRecorder fallback if active
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {}
      mediaRecorderRef.current = null;
    }

    isInitializingRef.current = false;
    setVadState('idle');
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (disabledRef.current || isInitializingRef.current || isListeningRef.current) return;
    isInitializingRef.current = true;
    setErrorDetails(null);

    // Step 1: Explicitly request getUserMedia to test mic access & handle errors
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      setPermissionState('granted');
      // Stop temporary stream before initializing VAD
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      isInitializingRef.current = false;
      let userMsg = 'Failed to access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        userMsg = 'Microphone permission denied. Please click the camera/mic icon in your address bar to allow access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionState('error');
        userMsg = 'No microphone device found on your hardware.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setPermissionState('error');
        userMsg = 'Microphone is currently in use by another application.';
      }
      setErrorDetails(userMsg);
      setVadState('idle');
      setIsListening(false);
      return;
    }

    // Step 2: Try initializing VAD library (@ricky0123/vad-web)
    try {
      setVadState('listening');
      setIsListening(true);

      const { MicVAD } = await import('@ricky0123/vad-web');

      if (vadRef.current) {
        await vadRef.current.destroy();
      }

      const vad = await MicVAD.new({
        modelURL: '/silero_vad_v5.onnx',
        workletURL: '/vad.worklet.bundle.min.js',
        onnxWASMPath: '/ort-wasm-simd-threaded.wasm',
        positiveSpeechThreshold: 0.6,
        negativeSpeechThreshold: 0.4,
        redemptionFrames: Math.max(8, Math.round((silenceDurationMsRef.current / 1000) * 30)),
        preSpeechPadFrames: 10,
        minSpeechFrames: 5,
        onSpeechStart: () => {
          setVadState('speech_detected');
        },
        onSpeechEnd: (audio) => {
          setVadState('processing');
          if (audio && audio.length > 0) {
            const wavBuffer = encodeWAV(audio, 16000);
            if (onSpeechEndRef.current) {
              onSpeechEndRef.current(wavBuffer);
            }
          }
          setTimeout(() => {
            if (isListeningRef.current) {
              setVadState('listening');
            }
          }, 300);
        }
      });

      vadRef.current = vad;
      await vad.start();
      isInitializingRef.current = false;
    } catch (vadErr) {
      console.warn('[useVad] VAD init failed, falling back to manual MediaRecorder capture:', vadErr);
      // Fall back to simple MediaRecorder manual capture
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          setVadState('processing');
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            try {
              const arrayBuffer = await blob.arrayBuffer();
              // Convert audio blob to Float32Array PCM for WAV encoding
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
              const decoded = await audioCtx.decodeAudioData(arrayBuffer);
              const pcm = decoded.getChannelData(0);
              const wavBuffer = encodeWAV(pcm, 16000);
              if (onSpeechEndRef.current) {
                onSpeechEndRef.current(wavBuffer);
              }
            } catch (decErr) {
              console.warn('[useVad] Audio decode error:', decErr);
            }
          }
          setVadState('idle');
          setIsListening(false);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setVadState('listening');
        setIsListening(true);
        isInitializingRef.current = false;
      } catch (fallbackErr) {
        console.error('[useVad] Fallback capture failed:', fallbackErr);
        setErrorDetails('Unable to initialize voice recording.');
        setVadState('idle');
        setIsListening(false);
        isInitializingRef.current = false;
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    vadState,
    isListening,
    permissionState,
    errorDetails,
    startListening,
    stopListening,
    toggleListening
  };
};
