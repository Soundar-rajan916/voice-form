import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info } from 'lucide-react';

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
            <h3 className="text-lg font-bold text-white">Voice Privacy Guarantee</h3>
            <p className="text-xs text-indigo-400">Audio Security & Privacy</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-6">
          <p className="font-semibold text-indigo-300">
            "Your voice is converted to text and not saved."
          </p>
          <ul className="space-y-2 text-xs text-slate-400 list-disc list-inside">
            <li>Audio streams strictly in-memory during active speech recognition.</li>
            <li>No audio recordings are ever written to disk, stored in databases, or logged.</li>
            <li>Only extracted text transcripts and cleaned form answers are persisted.</li>
            <li>Speech transcription is processed via Groq's high-speed Whisper cloud API.</li>
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
