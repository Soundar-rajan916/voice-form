import { describe, it, expect } from 'vitest';
import { en } from '../en';
import { ta } from '../ta';
import { getTranslation, hasUnresolvedPlaceholders, assertNoUnresolvedPlaceholders } from '../index';

describe('i18n Translation Placeholder Integrity', () => {
  it('detects unreplaced placeholders with hasUnresolvedPlaceholders helper', () => {
    expect(hasUnresolvedPlaceholders('Hello {name}!')).toBe(true);
    expect(hasUnresolvedPlaceholders('Hello {{name}}!')).toBe(true);
    expect(hasUnresolvedPlaceholders('3 of 5 answered')).toBe(false);
    expect(hasUnresolvedPlaceholders('வணக்கம்')).toBe(false);
  });

  it('replaces single and double braces with getTranslation', () => {
    const resSingle = getTranslation('en', 'sheet_progress', { answered: 3, total: 5 });
    expect(resSingle).toBe('3 of 5 answered');
    expect(hasUnresolvedPlaceholders(resSingle)).toBe(false);

    const resTamil = getTranslation('ta', 'sheet_progress', { answered: 3, total: 5 });
    expect(resTamil).toContain('3');
    expect(resTamil).toContain('5');
    expect(hasUnresolvedPlaceholders(resTamil)).toBe(false);
  });

  it('replaces all placeholders when parameters are provided', () => {
    const paramsMap = {
      login_title: { appName: 'Citizen Desk' },
      kiosk_privacy_text: { days: 30 },
      kiosk_idle_text: { seconds: 15 },
      welcome_msg: { title: 'Pension Form' },
      sheet_progress: { answered: 2, total: 4 },
      name_confirm_prompt: { value: 'Kumar' },
      editing_banner: { field: 'Phone number' },
      lang_active_badge: { lang: 'English' },
      chat_status_progress: { current: 1, total: 5 },
      review_edit_aria: { field: 'Email' },
      edit_reask_intro: { field: 'Address', currentValue: '123 Main St' },
      edit_banner_label: { field: 'Address' },
      edit_row_aria: { label: 'Name' }
    };

    ['en', 'ta'].forEach((lang) => {
      const dict = lang === 'en' ? en : ta;
      Object.entries(paramsMap).forEach(([key, params]) => {
        if (dict[key]) {
          const rendered = getTranslation(lang, key, params);
          expect(hasUnresolvedPlaceholders(rendered)).toBe(false);
          assertNoUnresolvedPlaceholders(rendered, `${lang}.${key}`);
        }
      });
    });
  });

  it('scans all translation keys in en and ta to ensure no stray unescaped placeholders exist in static strings', () => {
    const knownParameterizedKeys = new Set([
      'login_title',
      'kiosk_privacy_text',
      'kiosk_idle_text',
      'welcome_msg',
      'sheet_progress',
      'name_confirm_prompt',
      'editing_banner',
      'lang_active_badge',
      'chat_status_progress',
      'review_edit_aria',
      'edit_reask_intro',
      'edit_banner_label',
      'edit_row_aria'
    ]);

    // Check English dictionary
    Object.entries(en).forEach(([key, val]) => {
      if (!knownParameterizedKeys.has(key)) {
        if (hasUnresolvedPlaceholders(val)) {
          throw new Error(`Key "en.${key}" has unresolved placeholder: "${val}"`);
        }
      }
    });

    // Check Tamil dictionary
    Object.entries(ta).forEach(([key, val]) => {
      if (!knownParameterizedKeys.has(key)) {
        if (hasUnresolvedPlaceholders(val)) {
          throw new Error(`Key "ta.${key}" has unresolved placeholder: "${val}"`);
        }
      }
    });
  });

  it('verifies en and ta have matching keys with no missing entries', () => {
    const enKeys = Object.keys(en).sort();
    const taKeys = Object.keys(ta).sort();

    const missingInTa = enKeys.filter(k => !(k in ta));
    const missingInEn = taKeys.filter(k => !(k in en));

    expect(missingInTa).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
