import React, { useEffect, useRef } from 'react';
import { X, Edit2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { getTranslation } from '../i18n';

export const ReviewModal = ({
  isOpen,
  onClose,
  onConfirm,
  fields = [],
  answers = {},
  onEditField,
  submitting = false,
  submitError = null,
  onRetry = null,
  uiLang = 'en',
  triggerRef = null
}) => {
  const modalRef = useRef(null);
  const t = (key, params) => getTranslation(uiLang, key, params);

  // Missing answers check
  const unansweredFields = fields.filter((f) => {
    const val = answers[f.id];
    return val === undefined || val === null || String(val).trim() === '';
  });

  // Focus trap and Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const modalEl = modalRef.current;
    if (!modalEl) return;

    // Focus first focusable element
    const focusableElements = modalEl.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(focusableElements);
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Return focus to trigger button when modal closes
      if (triggerRef && triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        className="w-full max-w-2xl bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#1C1917]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#D6CCC2] flex items-center justify-between shrink-0 bg-[#F5EBE0]">
          <div>
            <h2 id="review-modal-title" className="text-xl sm:text-2xl font-bold font-display text-[#1C1917]">
              {t('review_modal_title')}
            </h2>
            <p className="text-sm text-[#524E4A] font-body mt-0.5">
              {t('review_modal_subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('review_btn_back')}
            className="p-2 text-[#524E4A] hover:text-[#1C1917] hover:bg-[#E3D5CA] rounded-md transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Missing Fields Banner at Top */}
          {unansweredFields.length > 0 && (
            <div
              role="alert"
              className="p-4 bg-[#9A3412]/10 border border-[#9A3412]/30 rounded-lg text-sm font-body text-[#9A3412] flex items-start space-x-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#9A3412]" aria-hidden="true" />
              <div className="flex-1">
                <span className="font-semibold block mb-1">
                  {t('review_missing_warning')}
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {unansweredFields.map((f) => {
                    const fName = f.field_name.replace(/_/g, ' ');
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditField(f.id);
                        }}
                        className="px-2.5 py-1 bg-[#F5EBE0] border border-[#9A3412]/40 rounded text-xs font-semibold text-[#9A3412] hover:bg-white transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{fName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Submission Error Banner */}
          {submitError && (
            <div
              role="alert"
              className="p-4 bg-[#B3261E]/10 border border-[#B3261E]/30 rounded-lg text-sm font-body text-[#B3261E] flex items-start justify-between space-x-3"
            >
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#B3261E]" aria-hidden="true" />
                <div>
                  <span className="font-semibold block">{t('review_error_title')}</span>
                  <p className="mt-0.5 text-sm">{submitError}</p>
                </div>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1.5 bg-[#B3261E] text-white text-xs font-semibold rounded-md hover:bg-[#B3261E]/90 cursor-pointer shrink-0"
                >
                  {t('review_btn_retry')}
                </button>
              )}
            </div>
          )}

          {/* Label / Value List (No nested scrolling) */}
          <div className="divide-y divide-[#D6CCC2] border border-[#D6CCC2] rounded-lg bg-[#F5EBE0] overflow-hidden">
            {fields.map((field) => {
              const val = answers[field.id];
              const hasVal = val !== undefined && val !== null && String(val).trim() !== '';
              const rawLabel = field.field_name ? field.field_name.replace(/_/g, ' ') : '';
              const editAria = t('review_edit_aria', { field: rawLabel });

              return (
                <div
                  key={field.id}
                  className="p-4 flex items-center justify-between hover:bg-[#E3D5CA]/40 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#524E4A] font-body block mb-1">
                      {rawLabel}
                    </span>
                    <div className="text-base sm:text-[17px] font-body font-medium text-[#1C1917] break-words">
                      {hasVal ? (
                        <span>{val}</span>
                      ) : (
                        <span className="text-[#9A3412] italic text-sm font-normal">
                          {t('review_field_unanswered')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditField(field.id);
                    }}
                    aria-label={editAria}
                    className="px-3 py-2 text-sm font-semibold text-[#1F3FBF] hover:bg-[#E3D5CA] rounded-md transition-colors cursor-pointer flex items-center space-x-1 shrink-0 min-h-[44px] min-w-[44px] justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
                  >
                    <Edit2 className="w-4 h-4 mr-1" aria-hidden="true" />
                    <span>{t('review_edit_action')}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Lock Notice */}
          <p className="text-sm text-[#524E4A] font-body text-center pt-2">
            {t('review_locked_notice')}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#D6CCC2] bg-[#F5EBE0] flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2.5 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors cursor-pointer min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
          >
            {t('review_btn_back')}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 cursor-pointer min-h-[44px] flex items-center justify-center space-x-2 focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            <span>{submitting ? t('review_btn_submitting') : t('review_btn_confirm')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
