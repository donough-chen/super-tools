/**
 * 通知模板渲染器（轻量替换器）
 *
 * 只支持 {{variable.path}} 占位符 + 系统内置变量自动注入。
 * 不引入 Handlebars/EJS 等第三方模板引擎，避免模板注入风险与依赖体积。
 *
 * 安全约束：
 * 1. 用户传入的 variable 值不参与二次解析（即使值包含 {{}} 也作为字面量替换）
 * 2. HTML 渠道（in_app/email）默认对值做 HTML escape
 * 3. 短信等纯文本渠道使用 escape: 'none'
 *
 * Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.2)
 */

export type EscapeMode = 'html' | 'none';

export interface RenderOptions {
  /** 转义模式：HTML 渠道用 'html'（默认），短信用 'none' */
  escape?: EscapeMode;
}

export interface RenderResult {
  /** 渲染后的字符串 */
  result: string;
  /** 模板中存在但变量未提供的占位符（未替换、保持 {{xxx}} 字面量） */
  missingVars: string[];
  /** 渲染过程中的警告（如类型转换） */
  warnings: string[];
}

/** 提取 {{var}} 占位符的正则；只匹配字母、数字、下划线、点 */
const PLACEHOLDER_RE = /\{\{([\w.]+)\}\}/g;

/** 沿路径取嵌套值；任一层为 null/undefined 即返回 undefined */
export function getByPath(obj: any, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * HTML 转义（5 个特殊字符）
 * 关键：& 必须最先替换，避免 < → &lt; 后 & 被二次替换为 &amp;lt;
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 将任意值转为字符串（undefined 单独处理；null 转 ''） */
function toStringValue(v: unknown): string {
  if (v === null) return '';
  return String(v);
}

/**
 * 渲染模板
 * @param template 模板字符串，含 {{var}} 占位符
 * @param variables 变量对象（支持嵌套路径）
 * @param options 渲染选项
 */
export function renderTemplate(
  template: string,
  variables: Record<string, any>,
  options: RenderOptions = {},
): RenderResult {
  const escape = options.escape ?? 'html';
  const missing: string[] = [];
  const warnings: string[] = [];

  const result = template.replace(PLACEHOLDER_RE, (match, path) => {
    const value = getByPath(variables, path);
    if (value === undefined) {
      missing.push(path);
      return match; // 保留 {{path}} 字面量
    }
    let str = toStringValue(value);
    if (escape === 'html') {
      str = escapeHtml(str);
    }
    return str;
  });

  return { result, missingVars: missing, warnings };
}
