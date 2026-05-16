export const SUPPORTED_LANGS = ['zh-CN', 'en-US'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];
export const DEFAULT_LANG: SupportedLang = 'zh-CN';

export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}
