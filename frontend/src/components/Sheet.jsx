import React from 'react';
import { Link } from 'react-router-dom';
import { SheetRow } from './SheetRow';
import { StampOverlay } from './StampOverlay';
import { getTranslation } from '../i18n';
import { brandConfig } from '../brand';

export const Sheet = ({
  fields = [],
  answers = {},
  currentFieldId = null,
  editingFieldId = null,
  mode = "normal",
  allAnswered = false,
  submissionStatus = "in_progress",
  submitting = false,
  onSubmit, // opens review modal
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
    <div className="sheet-shadow bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg p-5 flex flex-col relative overflow-hidden h-full text-[#1C1917]">
      {isSubmitted && <StampOverlay text={t('stamp_submitted')} />}

      {/* Header: "Your answers" title with progress bar (no duplicated form title) */}
      <div className="border-b border-[#D6CCC2] pb-3 mb-2 shrink-0">
        <h2 className="text-xl font-bold font-body text-[#1C1917] mb-1">
          {t('panel_title_answers')}
        </h2>

        <div className="flex items-center justify-between text-sm text-[#524E4A] font-body mb-2">
          <span>
            {t('sheet_progress', { answered: answeredCount, total: fields.length })}
          </span>
          <span className="font-semibold text-[#1C1917]">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* Ink Progress Line */}
        <div className="w-full bg-[#D6CCC2] h-[3px] rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin="0" aria-valuemax="100">
          <div
            className="bg-[#1F3FBF] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Rows Container: Entire panel scrolls smoothly, no nested cards */}
      <div className="flex-1 overflow-y-auto space-y-0 divide-y divide-[#D6CCC2] pr-0.5">
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
              uiLang={uiLang}
            />
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="pt-3 border-t border-[#D6CCC2] mt-2 shrink-0 space-y-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || mode === 'editing' || !allAnswered || isSubmitted}
          className="w-full min-h-[48px] py-2.5 px-4 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-body font-semibold rounded-md text-base transition-colors focus-visible:outline-2 focus-visible:outline-[#1F3FBF] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitted
            ? t('btn_submitted')
            : submitting
            ? t('review_btn_submitting')
            : t('btn_review_and_submit')}
        </button>

        {/* Status text */}
        {!isSubmitted && mode === 'editing' && (
          <p className="text-sm text-[#524E4A] text-center font-body">
            {t('edit_banner_label', { field: '' })}
          </p>
        )}
        {!isSubmitted && mode !== 'editing' && !allAnswered && (
          <p className="text-sm text-[#524E4A] text-center font-body">
            {t('sheet_progress', { answered: answeredCount, total: fields.length })}
          </p>
        )}
        {isSubmitted && (
          <div className="text-center font-body pt-1 space-y-1">
            <p className="text-sm text-[#524E4A]">
              {brandConfig.officeName || 'Citizen Service Centre'}
            </p>
            <Link
              to="/user"
              className="inline-block text-sm font-semibold text-[#1F3FBF] underline hover:opacity-80"
            >
              {t('nav_submissions')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
