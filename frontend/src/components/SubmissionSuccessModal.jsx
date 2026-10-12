import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Check, ArrowRight, PlusCircle } from 'lucide-react';
import { getTranslation } from '../i18n';

export const SubmissionSuccessModal = ({
  isOpen,
  referenceNumber,
  officeName = 'Citizen Service Centre',
  formTitle = 'Application',
  uiLang = 'en'
}) => {
  const [copied, setCopied] = useState(false);
  const t = (key, params) => getTranslation(uiLang, key, params);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (referenceNumber) {
      navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-title"
      className="fixed inset-0 z-50 bg-[#1C1917]/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-[#F5EBE0] border border-[#D6CCC2] rounded-xl shadow-2xl p-6 sm:p-8 text-center text-[#1C1917]">
        {/* Success Icon Badge */}
        <div className="w-16 h-16 bg-[#15803D]/10 text-[#15803D] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
        </div>

        <h2 id="success-title" className="text-2xl font-bold font-display text-[#1C1917] mb-1">
          {t('success_title')}
        </h2>
        <p className="text-sm text-[#524E4A] font-body mb-6">
          {formTitle} — {officeName}
        </p>

        {/* Reference Number Box */}
        {referenceNumber && (
          <div className="bg-[#E3D5CA]/50 border border-[#D6CCC2] rounded-lg p-4 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#524E4A] block mb-1">
              {t('success_ref_label')}
            </span>
            <div className="flex items-center justify-center space-x-3">
              <span className="font-mono text-xl sm:text-2xl font-bold text-[#1C1917] tracking-wider">
                {referenceNumber}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={t('success_btn_copy')}
                title={t('success_btn_copy')}
                className="p-2 text-[#1F3FBF] hover:bg-[#E3D5CA] rounded-md transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
                ) : (
                  <Copy className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {copied && (
              <span className="text-xs text-[#15803D] font-medium block mt-1">
                {t('success_copied')}
              </span>
            )}
            <p className="text-xs text-[#524E4A] mt-2">
              {t('success_ref_hint')}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/user#my-submissions"
            className="w-full sm:w-auto px-6 py-3 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
          >
            <span>{t('success_btn_my_apps')}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>

          <Link
            to="/user"
            className="w-full sm:w-auto px-6 py-3 border border-[#D6CCC2] hover:bg-[#E3D5CA] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#1F3FBF]"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>{t('success_btn_start_another')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
