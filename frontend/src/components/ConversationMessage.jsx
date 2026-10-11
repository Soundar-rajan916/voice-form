import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

export const ConversationMessage = ({ message }) => {
  const { sender, text, isError, replaced, lang } = message;

  // Helper to detect Tamil characters if lang is not explicitly passed
  const isTamil = lang === 'ta' || /[\u0B80-\u0BFF]/.test(text || '');

  if (sender === 'user') {
    return (
      <div className="flex justify-end my-3">
        <div
          className={`max-w-[85%] bg-[#1F3FBF] text-[#F5EBE0] text-base px-4 py-2.5 rounded-lg font-sans-ui shadow-none ${
            replaced ? 'opacity-60 line-through' : ''
          }`}
          lang={isTamil ? 'ta' : 'en'}
        >
          <p className={isTamil ? 'tamil-text' : ''}>{text}</p>
          {replaced && (
            <span className="text-xs text-[#F5EBE0]/80 block mt-1 no-underline font-normal">
              Replaced
            </span>
          )}
        </div>
      </div>
    );
  }

  // System notice / error line
  if (isError) {
    return (
      <div className="my-2 py-1 text-sm font-sans-ui text-[#B3261E] flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-[#B3261E]" aria-hidden="true" />
        <span lang={isTamil ? 'ta' : 'en'}>{text}</span>
      </div>
    );
  }

  if (sender === 'system') {
    return (
      <div className="my-2 py-1 text-xs font-sans-ui text-[#23272F]/75 flex items-center space-x-2">
        <Info className="w-3.5 h-3.5 shrink-0 text-[#23272F]/60" aria-hidden="true" />
        <span lang={isTamil ? 'ta' : 'en'}>{text}</span>
      </div>
    );
  }

  // Bot Question - Printed serif text with 2px Ward rule on left, NO bubble
  return (
    <div className="my-4 pl-4 border-l-2 border-[#D6CCC2]">
      <p
        className={`font-serif text-xl sm:text-2xl text-[#23272F] leading-relaxed ${
          isTamil ? 'tamil-text' : ''
        }`}
        lang={isTamil ? 'ta' : 'en'}
      >
        {text}
      </p>
    </div>
  );
};
