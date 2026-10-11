import React, { useState } from 'react';
import { Delete, Globe, Check } from 'lucide-react';

// Unicode Tamil Character Sets
const TAMIL_VOWELS = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ'];
const TAMIL_CONSONANTS = ['க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'];
const TAMIL_GRANTHA = ['ஜ', 'ஷ', 'ஸ', 'ஹ', 'க்ஷ', 'ஸ்ரீ'];
const TAMIL_SIGNS = ['்', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ'];
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// QWERTY Layout Rows
const QWERTY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.']
];

export default function TamilVirtualKeyboard({ onInsert, onBackspace, onClear, onClose, defaultLang = 'ta' }) {
  const [currentLayout, setCurrentLayout] = useState(defaultLang); // 'ta' or 'en'
  const [shift, setShift] = useState(false);

  const handleKeyClick = (char) => {
    if (onInsert) {
      onInsert(shift ? char.toUpperCase() : char);
    }
  };

  return (
    <div className="w-full bg-[#D6CCC2] border-t-2 border-[#23272F] p-2 md:p-3 select-none transition-all shadow-lg">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentLayout(currentLayout === 'ta' ? 'en' : 'ta')}
            className="touch-target-64 px-4 py-2 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded flex items-center gap-2 hover:bg-[#D5BDAF] active:scale-95 transition"
            aria-label="Switch keyboard language"
          >
            <Globe className="w-5 h-5 text-[#5B2A86]" />
            <span>{currentLayout === 'ta' ? 'English (QWERTY)' : 'தமிழ் (Tamil)'}</span>
          </button>
          <span className="text-sm font-semibold text-[#23272F]">
            {currentLayout === 'ta' ? 'தமிழ் விசைப்பலகை' : 'English Keyboard'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="touch-target-64 px-3 py-2 bg-[#F5EBE0] text-[#B3261E] font-bold border-2 border-[#B3261E] rounded hover:bg-red-50 active:scale-95 transition"
            >
              Clear
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="touch-target-64 px-5 py-2 bg-[#5B2A86] text-white font-bold border-2 border-[#5B2A86] rounded flex items-center gap-2 hover:opacity-90 active:scale-95 transition"
            >
              <Check className="w-5 h-5" />
              <span>Done</span>
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Grid */}
      {currentLayout === 'ta' ? (
        <div className="space-y-2">
          {/* Numbers */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {NUMBERS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeyClick(n)}
                className="touch-target-64 min-w-[52px] h-[58px] bg-[#F5EBE0] text-[#23272F] text-xl font-bold border border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center"
              >
                {n}
              </button>
            ))}
          </div>

          {/* Vowels & Pulli */}
          <div className="flex flex-wrap gap-1.5 justify-center bg-[#F5EBE0]/40 p-1.5 rounded border border-[#23272F]/20">
            <span className="w-full text-xs font-bold text-[#5B2A86] text-center mb-0.5">உயிரெழுத்துக்கள் (Vowels) & புள்ளி</span>
            {TAMIL_VOWELS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleKeyClick(v)}
                className="touch-target-64 min-w-[54px] h-[58px] bg-[#F5EBE0] text-[#23272F] text-xl font-bold border border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center font-sans-counter"
              >
                {v}
              </button>
            ))}
          </div>

          {/* Vowel Signs (Combines with consonants or standalone) */}
          <div className="flex flex-wrap gap-1.5 justify-center bg-[#D5BDAF]/20 p-1.5 rounded border border-[#23272F]/20">
            <span className="w-full text-xs font-bold text-[#5B2A86] text-center mb-0.5">உயிர்மெய் குறியீடுகள் (Vowel Signs)</span>
            {TAMIL_SIGNS.map((s, idx) => (
              <button
                key={`sign-${idx}`}
                type="button"
                onClick={() => handleKeyClick(s)}
                className="touch-target-64 min-w-[54px] h-[58px] bg-[#F5EBE0] text-[#1F3FBF] text-2xl font-bold border border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center font-sans-counter"
                title={`Vowel Sign ${s}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Consonants & Grantha */}
          <div className="flex flex-wrap gap-1.5 justify-center bg-[#F5EBE0]/40 p-1.5 rounded border border-[#23272F]/20">
            <span className="w-full text-xs font-bold text-[#5B2A86] text-center mb-0.5">மெய்யெழுத்துக்கள் & கிரந்தம் (Consonants & Grantha)</span>
            {TAMIL_CONSONANTS.concat(TAMIL_GRANTHA).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleKeyClick(c)}
                className="touch-target-64 min-w-[54px] h-[58px] bg-[#F5EBE0] text-[#23272F] text-xl font-bold border border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center font-sans-counter"
              >
                {c}
              </button>
            ))}
          </div>

          {/* Bottom Row Controls */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleKeyClick(' ')}
              className="touch-target-64 flex-1 max-w-md h-[58px] bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center"
            >
              இடைவெளி (Space)
            </button>
            <button
              type="button"
              onClick={onBackspace}
              className="touch-target-64 px-6 h-[58px] bg-[#F5EBE0] text-[#B3261E] font-bold border-2 border-[#B3261E] rounded hover:bg-red-50 active:scale-95 transition flex items-center justify-center gap-2"
              aria-label="Backspace"
            >
              <Delete className="w-6 h-6" />
              <span>அழி (Del)</span>
            </button>
          </div>
        </div>
      ) : (
        /* QWERTY Layout */
        <div className="space-y-2">
          {QWERTY_ROWS.map((row, rIdx) => (
            <div key={`row-${rIdx}`} className="flex justify-center gap-1.5 flex-wrap">
              {rIdx === 3 && (
                <button
                  type="button"
                  onClick={() => setShift(!shift)}
                  className={`touch-target-64 px-4 h-[58px] font-bold border-2 border-[#23272F] rounded transition flex items-center justify-center ${
                    shift ? 'bg-[#5B2A86] text-white' : 'bg-[#F5EBE0] text-[#23272F]'
                  }`}
                >
                  Shift
                </button>
              )}
              {row.map((char) => {
                const disp = shift ? char.toUpperCase() : char;
                return (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyClick(disp)}
                    className="touch-target-64 min-w-[50px] h-[58px] bg-[#F5EBE0] text-[#23272F] text-xl font-bold border border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center"
                  >
                    {disp}
                  </button>
                );
              })}
              {rIdx === 3 && (
                <button
                  type="button"
                  onClick={onBackspace}
                  className="touch-target-64 px-4 h-[58px] bg-[#F5EBE0] text-[#B3261E] font-bold border-2 border-[#B3261E] rounded hover:bg-red-50 active:scale-95 transition flex items-center justify-center gap-1"
                  aria-label="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}

          {/* Bottom Space bar */}
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleKeyClick(' ')}
              className="touch-target-64 flex-1 max-w-lg h-[58px] bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded hover:bg-[#D5BDAF] active:bg-[#5B2A86] active:text-white transition flex items-center justify-center"
            >
              Space
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
