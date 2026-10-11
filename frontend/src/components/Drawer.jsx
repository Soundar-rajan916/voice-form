import React from 'react';
import { X } from 'lucide-react';

export const Drawer = ({ isOpen, onClose, title = "Sheet", children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-[#23272F]/40">
      <div
        className="bg-[#F5EBE0] border-t-2 border-[#1F3FBF] rounded-t-xl p-4 max-h-[85dvh] flex flex-col sheet-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#D6CCC2] mb-3">
          <span className="font-serif text-lg font-bold text-[#23272F]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1 text-[#23272F]/75 hover:text-[#23272F] rounded focus:ring-2 focus:ring-[#1F3FBF] focus:outline-none"
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
