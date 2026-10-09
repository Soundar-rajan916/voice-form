import React from 'react';
import { getTranslation } from '../i18n';

export const NameChoices = ({ heardValue, suggestions = [], onSelect, onChangeIt, onSpellIt, uiLang = 'en' }) => {
  const t = (key, params) => getTranslation(uiLang, key, params);

  return (
    <div className="bg-[#F3F5F6] border border-[#DDE3E6] p-4 rounded-lg my-3 space-y-3 font-sans-ui">
      <p className="text-sm font-medium text-[#2A2D30]">
        {t('name_confirm_prompt', { value: heardValue })}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(heardValue)}
          className="px-3 py-1.5 bg-[#1F3FBF] text-[#F3F5F6] rounded text-xs font-semibold hover:bg-[#1F3FBF]/90 transition-colors"
        >
          {t('btn_yes_confirm')}
        </button>

        {suggestions.slice(0, 3).map((alt, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(alt)}
            className="px-3 py-1.5 bg-[#DDE3E6] text-[#2A2D30] rounded text-xs font-medium hover:bg-[#DDE3E6]/80 transition-colors"
          >
            {alt}
          </button>
        ))}

        <button
          onClick={onChangeIt}
          className="px-3 py-1.5 border border-[#2A2D30B3] text-[#2A2D30] rounded text-xs hover:bg-[#DDE3E6]/40 transition-colors"
        >
          {t('btn_change_it')}
        </button>

        <button
          onClick={onSpellIt}
          className="px-3 py-1.5 border border-[#2A2D30B3] text-[#2A2D30] rounded text-xs hover:bg-[#DDE3E6]/40 transition-colors"
        >
          {t('btn_spell_it')}
        </button>
      </div>
    </div>
  );
};
