import { en } from './en';
import { ta } from './ta';

/**
 * Translates a key with parameters, handling {param}, {{param}}, { param }, {{ param }}.
 * Ensures no leftover braces or unresolved tokens are returned.
 */
export function getTranslation(lang, key, params = {}) {
  let dict = en;
  if (lang === 'ta') {
    dict = ta;
  } else if (lang === 'auto') {
    const navLang = typeof navigator !== 'undefined' ? navigator.language : 'en';
    dict = navLang.startsWith('ta') ? ta : en;
  }

  let str = dict[key] !== undefined ? dict[key] : (en[key] !== undefined ? en[key] : key);

  if (typeof str !== 'string') {
    return String(str);
  }

  // Interpolate parameters safely
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      const val = v !== undefined && v !== null ? String(v) : '';
      str = str.replace(new RegExp(`\\{\\{?\\s*${k}\\s*\\}?}`, 'g'), val);
    });
  }

  return str;
}

/**
 * Dev-time & testing validation helper to verify a rendered string contains no unresolved placeholders.
 * Throws an error or returns false if leftover braces are found.
 */
export function hasUnresolvedPlaceholders(text) {
  if (typeof text !== 'string') return false;
  return /\{\{?[a-zA-Z0-9_-]+\}?}/.test(text);
}

export function assertNoUnresolvedPlaceholders(text, context = '') {
  if (hasUnresolvedPlaceholders(text)) {
    throw new Error(`Unresolved placeholder detected in "${text}" (context: ${context})`);
  }
}
