import React from 'react';
import { getTranslation } from '../i18n';

export const EditBanner = ({ fieldName, onCancel, uiLang = 'en' }) => {
  const t = (key, params) => getTranslation(uiLang, key, params);
  const friendlyName = fieldName ? fieldName.replace(/_/g, ' ') : 'field';

  return (
    <div className="bg-[#FFE45C] border border-[#2A2E2C]/20 text-[#2A2E2C] p-3 rounded mb-4 flex items-center justify-between font-sans-ui text-xs">
      <div>
        <span>{t('editing_banner', { field: friendlyName })}</span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="px-2.5 py-1 bg-[#2A2E2C] text-[#F6F8F5] rounded text-xs font-semibold hover:bg-[#2A2E2C]/90 transition-colors focus:ring-2 focus:ring-[#1F3FBF] cursor-pointer"
      >
        {t('btn_keep_old')}
      </button>
    </div>
  );
};
