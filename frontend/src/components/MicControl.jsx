import React from 'react';
import { Mic, MicOff, Loader2, RotateCcw } from 'lucide-react';
import { getTranslation } from '../i18n';

export const MicControl = ({
  vadState = 'idle',
  isListening = false,
  permissionState = 'granted',
  micError = null,
  isDisabled = false,
  onTapMic,
  onRetryMic,
  uiLang = 'en'
}) => {
  const t = (key, params) => getTranslation(uiLang, key, params);

  // Determine current active state in state machine
  let activeState = 'idle';
  if (permissionState === 'denied' || micError === 'denied') {
    activeState = 'error_denied';
  } else if (micError === 'no_speech') {
    activeState = 'error_no_speech';
  } else if (micError === 'network') {
    activeState = 'error_network';
  } else if (vadState === 'processing') {
    activeState = 'processing';
  } else if (isListening || vadState === 'listening' || vadState === 'speech_detected') {
    activeState = 'listening';
  } else if (permissionState === 'prompt' && isListening) {
    activeState = 'requesting_permission';
  }

  const getStatusLabel = () => {
    switch (activeState) {
      case 'error_denied':
        return t('mic_error_denied');
      case 'error_no_speech':
        return t('mic_error_no_speech');
      case 'error_network':
        return t('mic_error_network');
      case 'processing':
        return t('mic_processing');
      case 'listening':
        return t('mic_listening_tap_to_stop');
      case 'requesting_permission':
        return t('mic_requesting_permission');
      case 'idle':
      default:
        return t('mic_idle');
    }
  };

  const statusLabel = getStatusLabel();
  const langName = uiLang === 'ta' ? 'தமிழ்' : 'English';

  return (
    <div className="flex items-center space-x-3 sm:space-x-4">
      {/* Aria-live announcement for screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {statusLabel}
      </div>

      {/* 64px Round Mic Button */}
      <div className="relative flex items-center justify-center shrink-0">
        {activeState === 'listening' && (
          <span
            className="absolute inset-0 rounded-full bg-[#1F3FBF]/20 animate-ping pointer-events-none"
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          onClick={onTapMic}
          disabled={isDisabled}
          className={`w-16 h-16 min-w-[64px] min-h-[64px] rounded-full flex items-center justify-center transition-all border-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#1F3FBF] focus-visible:outline-offset-2 ${
            activeState === 'listening'
              ? 'bg-[#1F3FBF] border-[#1F3FBF] text-white shadow-md'
              : activeState === 'processing'
              ? 'bg-[#E3D5CA] border-[#1F3FBF] text-[#1F3FBF]'
              : activeState.startsWith('error')
              ? 'bg-[#F5EBE0] border-[#B3261E] text-[#B3261E] hover:bg-[#B3261E]/10'
              : 'bg-[#F5EBE0] border-[#524E4A] text-[#1C1917] hover:bg-[#E3D5CA]'
          }`}
          title={statusLabel}
          aria-label={statusLabel}
        >
          {activeState === 'processing' ? (
            <Loader2 className="w-7 h-7 animate-spin text-[#1F3FBF]" aria-hidden="true" />
          ) : activeState === 'error_denied' ? (
            <MicOff className="w-7 h-7 text-[#B3261E]" aria-hidden="true" />
          ) : (
            <Mic className="w-7 h-7" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mic State Description & Labels */}
      <div className="flex flex-col justify-center font-body min-w-[140px] max-w-[240px]">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-[#1C1917] leading-tight">
            {statusLabel}
          </span>
          {activeState === 'listening' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-xs font-medium bg-[#1F3FBF] text-white">
              {langName}
            </span>
          )}
        </div>

        {/* Error hints and try again */}
        {activeState.startsWith('error') && (
          <div className="mt-1 flex flex-col space-y-1">
            <span className="text-sm text-[#524E4A] leading-tight">
              {t('mic_typing_hint')}
            </span>
            {onRetryMic && activeState !== 'error_denied' && (
              <button
                type="button"
                onClick={onRetryMic}
                className="text-sm font-medium text-[#1F3FBF] hover:underline flex items-center space-x-1 self-start cursor-pointer mt-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('mic_try_again')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
