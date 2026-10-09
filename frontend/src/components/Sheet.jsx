import React from 'react';
import { SheetRow } from './SheetRow';
import { StampOverlay } from './StampOverlay';
import { getTranslation } from '../i18n';

export const Sheet = ({
  formTitle = "Paper Form",
  fields = [],
  answers = {},
  currentFieldId = null,
  editingFieldId = null,
  mode = "normal",
  allAnswered = false,
  submissionStatus = "in_progress",
  submitting = false,
  onSubmit,
  onGotoField,
  uiLang = "en"
}) => {
  const isSubmitted = submissionStatus === 'submitted' || submissionStatus === 'completed';
  const answeredCount = fields.filter(f => answers[f.id] !== undefined && answers[f.id] !== null && String(answers[f.id]).trim() !== '').length;
  const progressPercent = fields.length > 0 ? (answeredCount / fields.length) * 100 : 0;
  const t = (key, params) => getTranslation(uiLang, key, params);

  return (
    <div className="paper-sheet rounded-lg p-6 flex flex-col relative overflow-hidden h-full">
      {isSubmitted && <StampOverlay text={t('stamp_submitted')} />}

      {/* Header */}
      <div className="border-b border-[#DDE3E6] pb-4 mb-4">
        <h2 className="font-serif-printed text-2xl font-bold text-[#2A2D30] mb-2 truncate">
          {formTitle}
        </h2>

        <div className="flex items-center justify-between text-xs text-[#2A2D30B3] font-sans-ui mb-2">
          <span>
            {answeredCount} of {fields.length} {t('sheet_progress')}
          </span>
          <span className="font-semibold">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* 2px Ink Progress Line */}
        <div className="w-full bg-[#DDE3E6] h-1 rounded-full overflow-hidden">
          <div
            className="bg-[#1F3FBF] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Ruled Rows Container */}
      <div className="flex-1 overflow-y-auto space-y-0 divide-y divide-[#DDE3E6]">
        {fields.map((field) => {
          const isCurrent = currentFieldId === field.id;
          const isEditing = mode === 'editing' && editingFieldId === field.id;
          return (
            <SheetRow
              key={field.id}
              field={field}
              answer={answers[field.id]}
              isCurrent={isCurrent}
              isEditing={isEditing}
              isDisabled={isSubmitted}
              onSelectField={onGotoField}
            />
          );
        })}
      </div>

      {/* Submit Action Bar */}
      <div className="pt-4 border-t border-[#DDE3E6] mt-4 space-y-2">
        <button
          onClick={onSubmit}
          disabled={submitting || mode === 'editing' || !allAnswered || isSubmitted}
          className="w-full py-3 px-4 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F3F5F6] font-sans-ui font-semibold rounded text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitted
            ? t('btn_submitted')
            : submitting
            ? "Submitting..."
            : t('btn_submit')}
        </button>

        {/* Disabled Reason Text */}
        {!isSubmitted && mode === 'editing' && (
          <p className="text-xs text-[#2A2D30B3] text-center font-sans-ui">
            Finish or cancel editing active field before submitting.
          </p>
        )}
        {!isSubmitted && mode !== 'editing' && !allAnswered && (
          <p className="text-xs text-[#2A2D30B3] text-center font-sans-ui">
            Complete all questions to enable submit.
          </p>
        )}
        {isSubmitted && (
          <p className="text-xs text-[#2A2D30B3] text-center font-sans-ui">
            Form submitted. Response is read-only.
          </p>
        )}
      </div>
    </div>
  );
};
