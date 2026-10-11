import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const PrivacyNoticeModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleAccept = () => {
    localStorage.setItem('voiceform_privacy_accepted', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23272F]/50">
      <div className="max-w-md w-full bg-[#F5EBE0] border border-[#D6CCC2] rounded-lg p-6 sheet-shadow text-[#23272F]">
        <div className="flex items-center space-x-3 mb-4 border-b border-[#D6CCC2] pb-3">
          <div className="w-10 h-10 rounded bg-[#D6CCC2] flex items-center justify-center text-[#1F3FBF] shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-serif text-[#23272F]">Privacy notice</h3>
            <p className="text-xs text-[#23272F]/75 font-sans-ui">Data handling and security</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-[#23272F] font-sans-ui bg-[#D6CCC2]/40 p-4 rounded border border-[#D6CCC2] mb-6">
          <p className="font-medium text-[#23272F]">
            Your voice is sent to our speech provider to be turned into text. The audio is not saved.
          </p>
          <p className="text-xs text-[#23272F]/75">
            Your document is read to fill this form and is deleted right after. Its text, and any scanned pages as images, are sent to our AI provider.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAccept}
            className="w-full py-2.5 px-4 bg-[#1F3FBF] hover:bg-[#1F3FBF]/90 text-[#F5EBE0] font-semibold rounded text-sm transition-colors font-sans-ui focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none cursor-pointer"
          >
            I understand and continue
          </button>
        </div>
      </div>
    </div>
  );
};
