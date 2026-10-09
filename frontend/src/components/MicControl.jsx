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
    if (vadState === 'speech_detected' || vadState === 'listening') return t('mic_listening');
    if (vadState === 'processing') return t('mic_processing');
    return t('mic_idle');
  };

  return (
    <div className="flex items-center space-x-4">
      {/* 72px Round Mic Button */}
      <button
        type="button"
        onClick={onTapMic}
        disabled={isDisabled || permissionState === 'denied'}
        className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
          isListening || vadState === 'speech_detected'
            ? 'bg-[#1F3FBF] border-[#1F3FBF] text-[#F3F5F6]'
            : 'bg-[#F3F5F6] border-[#2A2D30] text-[#2A2D30] hover:bg-[#DDE3E6]'
        }`}
        title={getStatusText()}
      >
        {permissionState === 'denied' ? (
          <MicOff className="w-7 h-7 text-[#C2312D]" />
        ) : (
          <Mic className="w-7 h-7" />
        )}
      </button>

      {/* Plain Text Status */}
      <div className="flex flex-col font-sans-ui">
        <span className="text-sm font-semibold text-[#2A2D30]">
          {getStatusText()}
        </span>
        {permissionState === 'denied' && (
          <span className="text-xs text-[#C2312D] max-w-xs mt-0.5">
            {t('mic_blocked')}
          </span>
        )}
      </div>
    </div>
  );
};
