import React from 'react';

export const StampOverlay = ({ text = "SUBMITTED" }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 overflow-hidden">
      <div className="border-4 border-[#C2312D] text-[#C2312D] text-3xl font-extrabold uppercase px-6 py-2 tracking-widest rounded animate-stamp-landing shadow-sm select-none">
        {text}
      </div>
    </div>
  );
};
