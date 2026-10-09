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

  return (
    <div
      onClick={() => !isDisabled && onSelectField(field.id)}
      className={`relative py-3 px-4 transition-all duration-250 border-b border-[#DDE3E6] cursor-pointer select-none ${
        isEditing
          ? 'bg-[#FFE45C] border-l-4 border-l-[#1F3FBF]'
          : isCurrent
          ? 'bg-[#FFE45C]'
          : isUpdated
          ? 'bg-[#FFE45C]/60'
          : 'hover:bg-[#DDE3E6]/30'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-sans-ui text-[#2A2D30B3]">
            {field.field_name.replace('_', ' ')}
          </span>
          {isAdmin && (
            <span className="text-[11px] font-mono text-[#2A2D30B3]">
              ({field.data_type})
            </span>
          )}
        </div>

        {!isDisabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectField(field.id);
            }}
            className="p-1 text-[#2A2D30B3] hover:text-[#1F3FBF] transition-colors"
            title={`Change ${field.field_name.replace('_', ' ')}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xl font-sans-ui font-semibold truncate max-w-[240px]">
          {hasValue ? (
            <span
              className={`inline-block transition-all ${
                isEditing
                  ? 'text-[#2A2D30B3] line-through italic'
                  : 'text-[#1F3FBF] animate-ink-reveal'
              }`}
            >
              {answer}
              {isEditing && <span className="no-underline text-xs ml-2 text-[#2A2D30B3] font-normal">(Previous answer)</span>}
            </span>
          ) : (
            <span className="text-[#2A2D30B3] text-sm font-normal italic">
              {isCurrent ? "Asking question..." : "—"}
            </span>
          )}
        </div>

        {hasValue && !isEditing && (
          <Check className="w-4 h-4 text-[#1F3FBF] flex-shrink-0 ml-2" />
        )}
      </div>
    </div>
  );
};
