import React from 'react';
import { brandConfig } from '../brand';

export const EmergencyNotice = () => {
  return (
    <div className="bg-[#FFE45C]/25 border-b border-[#23272F]/15 px-4 py-2 text-xs text-[#23272F] font-medium flex items-center justify-center space-x-2 shrink-0">
      <span className="font-semibold">Notice:</span>
      <span>{brandConfig.disclaimerEn}</span>
    </div>
  );
};
