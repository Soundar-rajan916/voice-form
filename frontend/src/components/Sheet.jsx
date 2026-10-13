import React from 'react';
import { Link } from 'react-router-dom';
import { SheetRow } from './SheetRow';
import { StampOverlay } from './StampOverlay';
import { getTranslation } from '../i18n';
import { brandConfig } from '../brand';
import { Sparkles, CheckCheck, Check, X, Edit3, AlertCircle } from 'lucide-react';

export const Sheet = ({
  fields = [],
  answers = {},
  proposals = [],
  currentFieldId = null,
  editingFieldId = null,
  mode = "normal",
  allAnswered = false,
  submissionStatus = "in_progress",
  submitting = false,
  onSubmit, // opens review modal
  onGotoField,
  onSelectChoice,
  onAcceptProposals,
  onDismissProposal,
  onEditProposal,
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

      {/* Document Proposals Section */}
      {proposals && proposals.length > 0 && !isSubmitted && (
        <div className="mb-3 p-3.5 bg-[#E3D5CA]/70 border border-[#1F3FBF]/30 rounded-lg space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-[#1F3FBF] shrink-0" />
              <span className="font-bold text-sm text-[#1C1917]">
                {t('proposals_title', { count: proposals.length })}
              </span>
            </div>
            {onAcceptProposals && (
              <button
                type="button"
                onClick={() => onAcceptProposals(proposals.map((p) => p.id))}
                className="px-2.5 py-1 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white text-xs font-semibold rounded shadow-xs flex items-center space-x-1 cursor-pointer transition-colors min-h-[30px]"
                title={t('proposals_accept_all', { count: proposals.length })}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t('proposals_accept_all', { count: proposals.length })}</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {proposals.map((prop) => {
              const matchedField = fields.find((f) => f.id === prop.field_id);
              const label = (
                matchedField
                  ? (uiLang === 'ta' && matchedField.question_ta
                      ? matchedField.question_ta
                      : (matchedField.question_en || matchedField.field_name))
                  : prop.field_name || ''
              ).replace(/_/g, ' ');

              return (
                <div
                  key={prop.id}
                  className="p-2.5 bg-[#F5EBE0] border border-[#D6CCC2] rounded-md text-xs space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[#524E4A] gap-2">
                    <span className="font-bold text-[#1C1917] capitalize truncate">
                      {label}
                    </span>
                    <span className="text-[10px] font-mono shrink-0">
                      p.{prop.page || 1} • {prop.read_method === 'vision' ? 'scan' : 'text'}
                    </span>
                  </div>

                  <div className="p-1.5 bg-[#E3D5CA]/40 rounded border border-[#D6CCC2] font-semibold text-sm text-[#1C1917] break-words">
                    {prop.value}
                  </div>

                  {prop.scanned_warning && (
                    <div className="flex items-center space-x-1 text-[11px] text-[#B45309]">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{t('proposals_scanned_notice')}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-1.5 pt-1 border-t border-[#D6CCC2]/60">
                    {onDismissProposal && (
                      <button
                        type="button"
                        onClick={() => onDismissProposal(prop.id)}
                        className="px-2 py-1 text-[#524E4A] hover:text-[#DC2626] hover:bg-[#E3D5CA] rounded flex items-center space-x-1 transition-colors cursor-pointer min-h-[28px]"
                        title={t('proposals_dismiss')}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{t('proposals_dismiss')}</span>
                      </button>
                    )}
                    {onEditProposal && (
                      <button
                        type="button"
                        onClick={() => onEditProposal(prop)}
                        className="px-2 py-1 text-[#524E4A] hover:text-[#1F3FBF] hover:bg-[#E3D5CA] rounded flex items-center space-x-1 transition-colors cursor-pointer min-h-[28px]"
                        title={t('proposals_edit')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t('proposals_edit')}</span>
                      </button>
                    )}
                    {onAcceptProposals && (
                      <button
                        type="button"
                        onClick={() => onAcceptProposals([prop.id])}
                        className="px-2.5 py-1 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-semibold rounded flex items-center space-x-1 transition-colors cursor-pointer min-h-[28px]"
                        title={t('proposals_accept')}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('proposals_accept')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              onSelectChoice={onSelectChoice}
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
