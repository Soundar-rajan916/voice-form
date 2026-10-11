import React from 'react';

export const StampOverlay = ({ text = "SUBMITTED" }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 overflow-hidden">
      <div className="stamp-submitted text-2xl sm:text-3xl select-none">
        {text}
      </div>
    </div>
  );
};
