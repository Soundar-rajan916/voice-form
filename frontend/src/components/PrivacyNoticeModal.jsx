import React from 'react';
import { ShieldCheck, FileText } from 'lucide-react';

export const PrivacyNoticeModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleAccept = () => {
    localStorage.setItem('voiceform_privacy_accepted', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="max-w-md w-full bg-slate-900 border border-indigo-900/60 rounded-2xl p-6 shadow-2xl shadow-indigo-950/50">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Privacy Guarantee</h3>
            <p className="text-xs text-indigo-400">Document & Audio Security</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-6">
          <p className="font-semibold text-indigo-300">
            "Your document is read to fill this form and is deleted right after. Scanned pages are sent as images to our AI provider."
          </p>
          <ul className="space-y-2 text-xs text-slate-400 list-disc list-inside">
            <li>Page images exist only in memory during processing and are never written to disk.</li>
            <li>Document transcripts are used only to extract form proposals.</li>
            <li>No document bytes or image data are stored after extraction finishes.</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAccept}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm flex items-center justify-center space-x-2"
          >
            <span>I Understand & Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
