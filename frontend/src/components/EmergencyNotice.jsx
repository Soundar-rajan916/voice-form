import React from 'react';
import { getTranslation } from '../i18n';
import { Info } from 'lucide-react';

export const EmergencyNotice = ({ uiLang = 'en' }) => {
  const disclaimerText = getTranslation(uiLang, 'disclaimer_banner');

  return (
    <aside
      aria-label="Portal disclaimer"
      className="bg-[#E3D5CA]/60 border-b border-[#D6CCC2] px-4 py-2 text-sm text-[#524E4A] font-medium flex items-center justify-center space-x-2 shrink-0 select-none"
    >
      <Info className="w-4 h-4 text-[#524E4A] shrink-0" aria-hidden="true" />
      <span lang={uiLang === 'ta' ? 'ta' : 'en'}>{disclaimerText}</span>
    </aside>
  );
};
