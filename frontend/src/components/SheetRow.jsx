import React from 'react';
import { Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getTranslation } from '../i18n';

export const SheetRow = ({
  field,
  answer,
  isCurrent = false,
  isEditing = false,
  isUpdated = false,
  isDisabled = false,
  onSelectField,
  uiLang = 'en'
}) => {
  const t = (key, params) => getTranslation(uiLang, key, params);
  const hasValue = answer !== undefined && answer !== null && String(answer).trim() !== '';

  const rawLabel = field.field_name ? field.field_name.replace(/_/g, ' ') : '';
  const label = uiLang === 'ta' && field.question_ta ? field.question_ta : rawLabel;
  const editAria = t('edit_row_aria', { label: rawLabel });

  const handleClick = () => {
    if (!isDisabled && onSelectField) {
      onSelectField(field.id);
    }
  };

  const handleKeyDown = (e) => {
    if (isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onSelectField) onSelectField(field.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={editAria}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`relative min-h-[64px] sm:min-h-[68px] py-2.5 px-4 transition-colors duration-150 border-b border-[#D6CCC2] cursor-pointer select-none flex flex-col justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF] focus-visible:outline-offset-2 ${
        isEditing
          ? 'bg-[#E3D5CA] border-l-4 border-l-[#1F3FBF]'
          : isCurrent
          ? 'bg-[#E3D5CA]/70 border-l-4 border-l-[#1F3FBF]'
          : isUpdated
          ? 'bg-[#E3D5CA]/40'
          : 'bg-[#F5EBE0] hover:bg-[#E3D5CA]/50'
      }`}
    >
      {/* Top Header: Field Label & Edit Affordance */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm font-semibold uppercase tracking-wider text-[#524E4A] font-body truncate max-w-[240px]">
          {rawLabel}
        </span>

        <div className="flex items-center space-x-2">
          {/* Status indicators for attention or recently updated only */}
          {isUpdated && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-xs font-medium bg-[#15803D]/10 text-[#15803D]">
              <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" />
              {t('status_just_updated')}
            </span>
          )}

          {!hasValue && !isCurrent && (
            <span className="inline-flex items-center text-xs text-[#9A3412]">
              <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
              {t('status_missing')}
            </span>
          )}

          {!isDisabled && (
            <span
              className="inline-flex items-center space-x-1 text-sm font-medium text-[#1F3FBF] hover:underline"
              aria-hidden="true"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('review_edit_action')}</span>
            </span>
          )}
        </div>
      </div>

      {/* Answer Value: Warm near-black primary text */}
      <div className="flex items-center justify-between">
        <div className="text-base sm:text-[17px] font-body font-medium truncate max-w-[320px]">
          {hasValue ? (
            <span className={`text-[#1C1917] ${isEditing ? 'line-through text-[#524E4A]' : ''}`}>
              {answer}
            </span>
          ) : (
            <span className="text-[#524E4A] text-sm italic font-normal">
              {isCurrent ? (uiLang === 'ta' ? 'கேள்வி கேட்கப்படுகிறது...' : 'Asking question...') : t('sheet_unfilled')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
