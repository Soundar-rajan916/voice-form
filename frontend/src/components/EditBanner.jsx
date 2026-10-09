import React from 'react';
import { getTranslation } from '../i18n';

export const EditBanner = ({ fieldName, onCancel, uiLang = 'en' }) => {
  const t = (key, params) => getTranslation(uiLang, key, params);
  const friendlyName = fieldName ? fieldName.replace('_', ' ') : 'field';

  return (
    <div className="bg-[#FFE45C] border border-[#2A2D30]/20 text-[#2A2D30] p-3 rounded mb-4 flex items-center justify-between font-sans-ui text-xs">
      <div>
        <span>{t('editing_banner', { field: friendlyName })}</span>
      </div>
      <button
        onClick={onCancel}
        className="px-2.5 py-1 bg-[#2A2D30] text-[#F3F5F6] rounded text-xs font-semibold hover:bg-[#2A2D30]/90 transition-colors"
      >
        {t('btn_keep_old')}
      </button>
    </div>
  );
};
