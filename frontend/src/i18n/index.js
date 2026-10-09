import { en } from './en';
import { ta } from './ta';

export function getTranslation(lang, key, params = {}) {
  let dict = en;
  if (lang === 'ta') {
    dict = ta;
  } else if (lang === 'auto') {
    const navLang = typeof navigator !== 'undefined' ? navigator.language : 'en';
    dict = navLang.startsWith('ta') ? ta : en;
  }

  let str = dict[key] || en[key] || key;

  Object.entries(params).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });

  return str;
}
