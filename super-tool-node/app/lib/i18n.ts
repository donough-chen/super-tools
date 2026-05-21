/**
 * @file 多语言支持工具
 * @description 定义系统支持的语言列表和语言校验函数。
 *   当前支持：zh-CN（简体中文）、en-US（英文）。
 *   用于模板多语言渲染和用户语言偏好校验。
 *
 * @module lib/i18n
 */
export const SUPPORTED_LANGS = ['zh-CN', 'en-US'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];
export const DEFAULT_LANG: SupportedLang = 'zh-CN';

export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}
