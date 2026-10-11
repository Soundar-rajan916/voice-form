import React from 'react';
import { getTranslation } from '../i18n';

export const NameChoices = ({ heardValue, suggestions = [], onSelect, onChangeIt, onSpellIt, uiLang = 'en' }) => {
  const t = (key, params) => getTranslation(uiLang, key, params);

  return (
    <div className="bg-[#F6F8F5] border border-[#DCE7E0] p-4 rounded-lg my-3 space-y-3 font-sans-ui text-[#2A2E2C]">
      <p className="text-sm font-medium text-[#2A2E2C]">
        {t('name_confirm_prompt', { value: heardValue })}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(heardValue)}
          className="px-3 py-1.5 bg-[#1F3FBF] text-[#F6F8F5] rounded text-xs font-semibold hover:bg-[#1F3FBF]/90 transition-colors focus:ring-2 focus:ring-[#1F3FBF] cursor-pointer"
        >
          {t('btn_yes_confirm')}
        </button>

        {suggestions.slice(0, 3).map((alt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(alt)}
            className="px-3 py-1.5 bg-[#DCE7E0] text-[#2A2E2C] rounded text-xs font-medium hover:bg-[#DCE7E0]/80 transition-colors focus:ring-2 focus:ring-[#1F3FBF] cursor-pointer"
          >
            {alt}
          </button>
        ))}

        <button
          type="button"
          onClick={onChangeIt}
          className="px-3 py-1.5 border border-[#2A2E2C]/50 text-[#2A2E2C] rounded text-xs hover:bg-[#DCE7E0]/40 transition-colors focus:ring-2 focus:ring-[#1F3FBF] cursor-pointer"
        >
          {t('btn_change_it')}
        </button>

        <button
          type="button"
          onClick={onSpellIt}
          className="px-3 py-1.5 border border-[#2A2E2C]/50 text-[#2A2E2C] rounded text-xs hover:bg-[#DCE7E0]/40 transition-colors focus:ring-2 focus:ring-[#1F3FBF] cursor-pointer"
        >
          {t('btn_spell_it')}
        </button>
      </div>
    </div>
  );
};
