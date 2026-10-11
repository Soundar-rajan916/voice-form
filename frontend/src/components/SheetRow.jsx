import React from 'react';
import { Check, Edit2 } from 'lucide-react';

export const SheetRow = ({
  field,
  answer,
  isCurrent,
  isEditing,
  isUpdated,
  isAdmin = false,
  isDisabled = false,
  onSelectField
}) => {
  const hasValue = answer !== undefined && answer !== null && String(answer).trim() !== '';
  const label = field.field_name ? field.field_name.replace(/_/g, ' ') : '';

  return (
    <div
      onClick={() => !isDisabled && onSelectField && onSelectField(field.id)}
      className={`relative py-3 px-4 transition-colors duration-200 border-b border-[#D6CCC2] cursor-pointer select-none ${
        isEditing
          ? 'bg-[#D5BDAF] border-l-4 border-l-[#1F3FBF]'
          : isCurrent
          ? 'bg-[#D5BDAF]'
          : isUpdated
          ? 'bg-[#D5BDAF]/50'
          : 'hover:bg-[#E3D5CA]/40'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#23272F]/75 font-sans-ui">
            {label}
          </span>
          {isAdmin && (
            <span className="text-[11px] text-[#23272F]/60">
              ({field.data_type})
            </span>
          )}
        </div>

        {!isDisabled && onSelectField && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectField(field.id);
            }}
            className="p-1 text-[#23272F]/60 hover:text-[#1F3FBF] focus:outline-none transition-colors"
            title={`Change ${label}`}
            aria-label={`Change ${label}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg sm:text-xl font-sans-ui font-medium truncate max-w-[260px]">
          {hasValue ? (
            <span
              className={`inline-block transition-all ${
                isEditing
                  ? 'text-[#23272F]/75 line-through italic'
                  : 'text-[#1F3FBF] animate-ink-reveal'
              }`}
            >
              {answer}
              {isEditing && (
                <span className="no-underline text-xs ml-2 text-[#23272F]/75 font-normal">
                  (Previous answer)
                </span>
              )}
            </span>
          ) : (
            <span className="text-[#23272F]/60 text-sm font-normal italic">
              {isCurrent ? "Asking question..." : "—"}
            </span>
          )}
        </div>

        {hasValue && !isEditing && (
          <Check className="w-4 h-4 text-[#1F3FBF] shrink-0 ml-2" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
