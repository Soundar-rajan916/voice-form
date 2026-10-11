import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { getTranslation } from '../i18n';

export const MicControl = ({
  vadState = 'idle',
  isListening = false,
  permissionState = 'granted',
  isDisabled = false,
  onTapMic,
  uiLang = 'en'
}) => {
  const t = (key) => getTranslation(uiLang, key);

  const getStatusText = () => {
    if (permissionState === 'denied') return t('mic_blocked');
    if (isDisabled) return "Form submitted";
    if (vadState === 'speech_detected' || vadState === 'listening' || isListening) return t('mic_listening');
    if (vadState === 'processing') return t('mic_processing');
    return t('mic_idle');
  };

  return (
    <div className="flex items-center space-x-4">
      {/* 88px Round Mic Button */}
      <div className="relative flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={onTapMic}
          disabled={isDisabled || permissionState === 'denied'}
          className={`w-[88px] h-[88px] rounded-full flex items-center justify-center transition-colors border-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none ${
            isListening || vadState === 'speech_detected'
              ? 'bg-[#1F3FBF] border-[#1F3FBF] text-[#F5EBE0]'
              : 'bg-[#F5EBE0] border-[#23272F] text-[#23272F] hover:bg-[#E3D5CA]'
          }`}
          style={{
            outline: isListening ? 'calc(var(--mic-level, 0) * 8px + 2px) solid rgba(31, 63, 191, 0.4)' : 'none'
          }}
          title={getStatusText()}
          aria-label={getStatusText()}
        >
          {permissionState === 'denied' ? (
            <MicOff className="w-8 h-8 text-[#B3261E]" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>
      </div>

      {/* Plain Text Status */}
      <div className="flex flex-col font-sans-ui">
        <span className="text-base font-semibold text-[#23272F]">
          {getStatusText()}
        </span>
        {permissionState === 'denied' && (
          <span className="text-xs text-[#B3261E] max-w-xs mt-0.5">
            {t('mic_blocked')}
          </span>
        )}
      </div>
    </div>
  );
};
