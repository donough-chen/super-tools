/**
 * 反馈话术 - 变量处理工具
 *
 * 功能：
 * 1. 从模板中提取 {{varName}} 占位符列表
 * 2. 区分内置变量与自定义变量
 * 3. 本地预览渲染（前端不依赖后端 /render 接口的轻量预览）
 *
 * 与后端 app/lib/templateRenderer.ts 保持语义一致：
 * - 占位符正则 \{\{([\w.]+)\}\}
 * - 缺失变量保留 {{xxx}} 字面量
 * - 本地预览不做 HTML 转义（编辑预览场景）
 */

/** 后端定义的内置变量名（feedbackSnippet.service._buildBuiltinVariables） */
export const BUILTIN_VARS = [
  'currentDate',
  'feedbackId',
  'feedbackType',
  'userName',
  'adminName',
] as const;

export type BuiltinVarName = (typeof BUILTIN_VARS)[number];

const PLACEHOLDER_RE = /\{\{([\w.]+)\}\}/g;

/**
 * 提取模板中所有占位符（去重，保持出现顺序）
 */
export function extractPlaceholders(template: string): string[] {
  if (!template) return [];
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((m = re.exec(template)) !== null) {
    set.add(m[1]);
  }
  return Array.from(set);
}

/**
 * 区分内置 / 自定义变量
 */
export function classifyVariables(template: string): {
  builtin: string[];
  custom: string[];
  all: string[];
} {
  const all = extractPlaceholders(template);
  const builtin: string[] = [];
  const custom: string[] = [];
  const builtinSet = new Set<string>(BUILTIN_VARS);

  all.forEach((name) => {
    // 取根字段（如 user.name → user）
    const root = name.split('.')[0];
    if (builtinSet.has(root as BuiltinVarName)) builtin.push(name);
    else custom.push(name);
  });

  return { builtin, custom, all };
}

/** 沿点路径取嵌套值 */
function getByPath(obj: Record<string, any>, path: string): any {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * 本地预览渲染（不替换内置变量，仅替换提供的 variables 中存在的字段）
 * 适用于编辑话术时实时预览 sample_variables。
 */
export function renderPreview(
  template: string,
  variables: Record<string, any> = {},
): { result: string; missing: string[] } {
  if (!template) return { result: '', missing: [] };
  const missing: string[] = [];

  const result = template.replace(PLACEHOLDER_RE, (match, path) => {
    const v = getByPath(variables, path);
    if (v === undefined || v === null) {
      missing.push(path);
      return match;
    }
    return String(v);
  });

  return { result, missing };
}

/**
 * 标签辅助：管道分隔字符串 ↔ 数组
 */
export function tagsToArray(tags?: string | null): string[] {
  if (!tags) return [];
  return String(tags).split('|').map((t) => t.trim()).filter(Boolean);
}

export function arrayToTags(arr?: string[] | null): string {
  if (!arr || arr.length === 0) return '';
  return arr.map((t) => t.trim()).filter(Boolean).join('|');
}
