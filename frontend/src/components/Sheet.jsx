import React from 'react';
import { Link } from 'react-router-dom';
import { SheetRow } from './SheetRow';
import { StampOverlay } from './StampOverlay';
import { getTranslation } from '../i18n';
import { brandConfig } from '../brand';

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
  const answeredCount = fields.filter(
    f => answers[f.id] !== undefined && answers[f.id] !== null && String(answers[f.id]).trim() !== ''
  ).length;
  const progressPercent = fields.length > 0 ? (answeredCount / fields.length) * 100 : 0;
  const t = (key, params) => getTranslation(uiLang, key, params);

  return (
    <div className="sheet-shadow bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg p-6 flex flex-col relative overflow-hidden h-full text-[#2A2E2C]">
      {isSubmitted && <StampOverlay text={t('stamp_submitted')} />}

      {/* Header */}
      <div className="border-b border-[#DCE7E0] pb-4 mb-4">
        <span className="block text-xs font-semibold uppercase tracking-widest text-[#2A2E2C]/75 font-sans-ui mb-1">
          {brandConfig.hospitalName}
        </span>
        <h2 className="font-serif text-2xl font-bold text-[#2A2E2C] mb-2 truncate">
          {formTitle}
        </h2>

        <div className="flex items-center justify-between text-xs text-[#2A2E2C]/75 font-sans-ui mb-2">
          <span>
            {answeredCount} of {fields.length} {t('sheet_progress')}
          </span>
          <span className="font-semibold">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* 2px Ink Progress Line */}
        <div className="w-full bg-[#DCE7E0] h-[2px] rounded-full overflow-hidden">
          <div
            className="bg-[#1F3FBF] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Ruled Rows Container */}
      <div className="flex-1 overflow-y-auto space-y-0 divide-y divide-[#DCE7E0]">
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
      <div className="pt-4 border-t border-[#DCE7E0] mt-4 space-y-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || mode === 'editing' || !allAnswered || isSubmitted}
          className="w-full py-3 px-4 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F6F8F5] font-sans-ui font-semibold rounded-md text-sm transition-colors focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitted
            ? t('btn_submitted')
            : submitting
            ? "Submitting..."
            : t('btn_submit')}
        </button>

        {/* Status text under submit button */}
        {!isSubmitted && mode === 'editing' && (
          <p className="text-xs text-[#2A2E2C]/75 text-center font-sans-ui">
            Finish or cancel editing active field before submitting.
          </p>
        )}
        {!isSubmitted && mode !== 'editing' && !allAnswered && (
          <p className="text-xs text-[#2A2E2C]/75 text-center font-sans-ui">
            Complete all questions to enable submit.
          </p>
        )}
        {isSubmitted && (
          <div className="text-center font-sans-ui pt-1 space-y-1">
            <p className="text-xs text-[#2A2E2C]/75">
              Your answers have been sent to {brandConfig.hospitalName}.
            </p>
            <Link
              to="/user"
              className="inline-block text-xs font-semibold text-[#1F3FBF] underline hover:opacity-80"
            >
              View my submitted forms
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
