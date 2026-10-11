import React from 'react';
import { Undo2 } from 'lucide-react';
import { getTranslation } from '../i18n';

export const Toast = ({ message, onUndo, uiLang = 'en' }) => {
  const t = (key) => getTranslation(uiLang, key);

  return (
    <div className="bg-[#2A2E2C] text-[#F6F8F5] text-xs font-sans-ui px-4 py-2.5 rounded flex items-center justify-between shadow-sm mb-2">
      <span>{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="ml-4 px-2 py-1 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] rounded font-semibold flex items-center space-x-1 cursor-pointer focus:ring-2 focus:ring-[#1F3FBF]"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>{t('btn_undo')}</span>
        </button>
      )}
    </div>
  );
};
