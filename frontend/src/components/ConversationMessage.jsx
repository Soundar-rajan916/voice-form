import React from 'react';
import { AlertCircle, Info, Bot, User, RotateCcw } from 'lucide-react';

export const ConversationMessage = ({ message, onRetryVoice }) => {
  const { sender, text, isError, replaced, lang, isVoice } = message;

  // Helper to detect Tamil characters if lang is not explicitly passed
  const isTamil = lang === 'ta' || /[\u0B80-\u0BFF]/.test(text || '');

  // User Message Bubble
  if (sender === 'user') {
    return (
      <div className="flex justify-end my-4">
        <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end">
          <div className="flex items-center space-x-1.5 mb-1 text-sm font-medium text-[#524E4A]">
            <span>{isTamil ? 'நீங்கள்' : 'You'}</span>
            <User className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div
            className={`bg-[#1F3FBF] text-white text-[18px] leading-relaxed px-5 py-3 rounded-2xl rounded-br-xs font-body shadow-xs ${
              replaced ? 'opacity-60 line-through' : ''
            }`}
            lang={isTamil ? 'ta' : 'en'}
          >
            <p className={isTamil ? 'tamil-text' : ''}>{text}</p>
            {replaced && (
              <span className="text-sm text-white/80 block mt-1.5 no-underline font-normal">
                {isTamil ? '(மாற்றப்பட்டது)' : '(Replaced)'}
              </span>
            )}
          </div>
          {isVoice && onRetryVoice && !replaced && (
            <button
              type="button"
              onClick={() => onRetryVoice(text)}
              className="mt-1 text-sm text-[#1F3FBF] hover:underline flex items-center space-x-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isTamil ? 'மீண்டும் பேச' : 'Re-record'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // System notice / error line (>= 14px text)
  if (isError) {
    return (
      <div
        role="alert"
        className="my-3 p-3 bg-[#B3261E]/10 border border-[#B3261E]/30 rounded-lg text-sm font-body text-[#B3261E] flex items-center space-x-2.5"
      >
        <AlertCircle className="w-5 h-5 shrink-0 text-[#B3261E]" aria-hidden="true" />
        <span lang={isTamil ? 'ta' : 'en'} className="font-medium">
          {text}
        </span>
      </div>
    );
  }

  if (sender === 'system') {
    return (
      <div className="my-3 p-3 bg-[#E3D5CA]/50 border border-[#D6CCC2] rounded-lg text-sm font-body text-[#524E4A] flex items-center space-x-2.5">
        <Info className="w-4 h-4 shrink-0 text-[#524E4A]" aria-hidden="true" />
        <span lang={isTamil ? 'ta' : 'en'}>{text}</span>
      </div>
    );
  }

  // Assistant Question / Message Bubble
  // Left-aligned, linen card with left border ink line, 20px typography, assistant badge
  return (
    <div className="my-4 max-w-[90%] sm:max-w-[85%]">
      <div className="flex items-center space-x-1.5 mb-1.5 text-sm font-medium text-[#524E4A]">
        <Bot className="w-4 h-4 text-[#1F3FBF]" aria-hidden="true" />
        <span>{isTamil ? 'உதவியாளர்' : 'Assistant'}</span>
      </div>
      <div
        className="bg-[#F5EBE0] border border-[#D6CCC2] border-l-4 border-l-[#1F3FBF] rounded-2xl rounded-bl-xs p-4 sm:p-5 shadow-xs"
        lang={isTamil ? 'ta' : 'en'}
      >
        <p
          className={`chat-bot-question text-[20px] text-[#1C1917] leading-relaxed font-body ${
            isTamil ? 'tamil-text' : ''
          }`}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
