import React from 'react';
import { getTranslation } from '../i18n';
import { Edit3, X } from 'lucide-react';

export const EditBanner = ({ fieldName, onCancel, uiLang = 'en' }) => {
  const t = (key, params) => getTranslation(uiLang, key, params);
  const friendlyName = fieldName ? fieldName.replace(/_/g, ' ') : 'field';

  return (
    <div
      role="region"
      aria-label="Active field editing banner"
      className="bg-[#E3D5CA]/90 border border-[#D6CCC2] text-[#1C1917] px-4 py-2.5 rounded-lg flex items-center justify-between font-body text-sm shadow-xs"
    >
      <div className="flex items-center space-x-2">
        <Edit3 className="w-4 h-4 text-[#1F3FBF] shrink-0" aria-hidden="true" />
        <span className="font-medium">
          {t('edit_banner_label', { field: friendlyName })}
        </span>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label={t('edit_btn_cancel')}
        className="px-3 py-1.5 bg-[#F5EBE0] border border-[#D6CCC2] text-[#1C1917] rounded-md text-sm font-medium hover:bg-white transition-colors focus-visible:outline-2 focus-visible:outline-[#1F3FBF] cursor-pointer flex items-center space-x-1 min-h-[36px]"
      >
        <X className="w-4 h-4 text-[#524E4A]" aria-hidden="true" />
        <span>{t('edit_btn_cancel')}</span>
      </button>
    </div>
  );
};
