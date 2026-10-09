import React from 'react';

export const ConversationMessage = ({ message }) => {
  const { sender, text, isError, replaced } = message;

  if (sender === 'user') {
    return (
      <div className="flex justify-end my-3">
        <div
          className={`max-w-[80%] bg-[#1F3FBF] text-[#F3F5F6] text-base px-4 py-2.5 rounded-[12px] font-sans-ui shadow-sm ${
            replaced ? 'opacity-50 line-through' : ''
          }`}
        >
          <p>{text}</p>
          {replaced && (
            <span className="text-xs text-[#F3F5F6]/80 block mt-1 no-underline">
              [Replaced]
            </span>
          )}
        </div>
      </div>
    );
  }

  // System notice / error line
  if (isError) {
    return (
      <div className="my-2 py-1 text-sm font-sans-ui text-[#C2312D] flex items-center space-x-2">
        <span>⚠️ {text}</span>
      </div>
    );
  }

  // Bot Question - Printed text (serif) with 2px Desk rule on left, NO bubble
  return (
    <div className="my-4 pl-4 border-l-2 border-[#DDE3E6]">
      <p className="font-serif-printed text-xl sm:text-2xl text-[#2A2D30] leading-snug">
        {text}
      </p>
    </div>
  );
};
