import React from 'react';
import { X } from 'lucide-react';

export const Drawer = ({ isOpen, onClose, title = "Sheet", children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-[#2A2D30]/40 backdrop-blur-none">
      <div
        className="bg-[#F3F5F6] border-t-2 border-[#1F3FBF] rounded-t-xl p-4 max-h-[85dvh] flex flex-col shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#DDE3E6] mb-3">
          <span className="font-serif-printed text-lg font-bold text-[#2A2D30]">{title}</span>
          <button
            onClick={onClose}
            className="p-1 text-[#2A2D30B3] hover:text-[#2A2D30] rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
