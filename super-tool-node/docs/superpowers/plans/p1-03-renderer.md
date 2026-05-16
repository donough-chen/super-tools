# P1-03：模板渲染纯函数（Task 3）

> 子文件 3/12，对应 [P1 总览](./2026-05-16-notification-phase-1-00-overview.md) Task 3。

**Goal:** 实现轻量模板渲染器（`{{var.path}}` 占位符替换），含 HTML 转义、安全防注入、变量缺失检测。先写测试再写实现（TDD）。

**Files:**
- Create: `super-tool-node/app/lib/templateRenderer.ts`
- Create: `super-tool-node/test/notification/lib/templateRenderer.test.ts`

**前置依赖**：[Task 1](./p1-01-deps-config.md)（无依赖于 DB 和 model，可并行）

---

## Step 1: 写失败的测试

- [ ] 创建测试文件目录

```bash
mkdir -p super-tool-node/test/notification/lib
```

- [ ] 创建 `super-tool-node/test/notification/lib/templateRenderer.test.ts`：

```ts
import { renderTemplate, getByPath, escapeHtml } from '../../../app/lib/templateRenderer';

describe('templateRenderer', () => {
  describe('renderTemplate', () => {
    it('should replace simple variables', () => {
      const r = renderTemplate('Hello {{user.name}}', { user: { name: '张三' } });
      expect(r.result).toBe('Hello 张三');
      expect(r.missingVars).toEqual([]);
    });

    it('should keep placeholder when variable missing', () => {
      const r = renderTemplate('Hi {{user.name}}, code: {{code}}', { user: { name: 'Tom' } });
      expect(r.result).toBe('Hi Tom, code: {{code}}');
      expect(r.missingVars).toEqual(['code']);
    });

    it('should escape HTML in default (HTML-safe) mode', () => {
      const r = renderTemplate('Msg: {{content}}', { content: '<script>alert(1)</script>' }, { escape: 'html' });
      expect(r.result).toBe('Msg: &lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should NOT escape in plain mode (sms)', () => {
      const r = renderTemplate('Code: {{code}}', { code: '123<456' }, { escape: 'none' });
      expect(r.result).toBe('Code: 123<456');
    });

    it('should support nested path', () => {
      const r = renderTemplate('{{a.b.c}}', { a: { b: { c: 'deep' } } });
      expect(r.result).toBe('deep');
    });

    it('should NOT recursively render variables (security against template injection)', () => {
      // 用户传入的 value 含 {{}} 不应被二次解析（即使 value 是恶意的）
      const r = renderTemplate('Hi {{name}}', { name: '{{secret}}' });
      expect(r.result).toBe('Hi {{secret}}');
    });

    it('should treat undefined as missing, not as string "undefined"', () => {
      const r = renderTemplate('{{x}}', { x: undefined });
      expect(r.result).toBe('{{x}}');
      expect(r.missingVars).toEqual(['x']);
    });

    it('should treat null as empty string (not "null")', () => {
      const r = renderTemplate('value=[{{x}}]', { x: null });
      expect(r.result).toBe('value=[]');
      expect(r.missingVars).toEqual([]);
    });

    it('should convert numbers and booleans to string', () => {
      const r = renderTemplate('count={{n}}, ok={{b}}', { n: 42, b: true });
      expect(r.result).toBe('count=42, ok=true');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const r = renderTemplate('{{x}} and {{x}}', { x: 'A' });
      expect(r.result).toBe('A and A');
    });

    it('should default to html escape mode', () => {
      const r = renderTemplate('{{x}}', { x: '<a>' });
      expect(r.result).toBe('&lt;a&gt;');
    });

    it('should ignore special chars in non-placeholder text', () => {
      const r = renderTemplate('foo<>{{x}}bar<>', { x: 'X' });
      // text 部分不被 escape，只 escape 替换值
      expect(r.result).toBe('foo<>Xbar<>');
    });
  });

  describe('getByPath', () => {
    it('should return value at simple path', () => {
      expect(getByPath({ a: 1 }, 'a')).toBe(1);
    });
    it('should return value at nested path', () => {
      expect(getByPath({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3);
    });
    it('should return undefined when path broken', () => {
      expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    });
    it('should return undefined when input is null', () => {
      expect(getByPath(null, 'a')).toBeUndefined();
    });
    it('should return undefined when input is undefined', () => {
      expect(getByPath(undefined, 'a')).toBeUndefined();
    });
  });

  describe('escapeHtml', () => {
    it('should escape <, >, &, ", \'', () => {
      expect(escapeHtml(`<a href="x" class='y'>&copy;</a>`))
        .toBe('&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;copy;&lt;/a&gt;');
    });
    it('should escape & before other entities (correct order)', () => {
      // 关键：& 必须先转义，否则 < 转换为 &lt; 后又被 & 二次转义为 &amp;lt;
      expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
    });
    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });
  });
});
```

---

## Step 2: 运行测试确认失败

- [ ] 跑测试看 FAIL

Run:

```bash
cd super-tool-node
npx jest test/notification/lib/templateRenderer.test.ts
```

Expected: FAIL with `Cannot find module '../../../app/lib/templateRenderer'` 或类似错误。

---

## Step 3: 实现 templateRenderer

- [ ] 创建目录

```bash
mkdir -p super-tool-node/app/lib
```

- [ ] 创建 `super-tool-node/app/lib/templateRenderer.ts`：

```ts
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
```

---

## Step 4: 运行测试确认通过

- [ ] 再跑测试

Run:

```bash
cd super-tool-node
npx jest test/notification/lib/templateRenderer.test.ts
```

Expected: PASS（共 16 个测试用例：renderTemplate 12 + getByPath 5 + escapeHtml 3 中标准测的话约这数；以实际通过数为准）。

如有失败：
- 检查测试代码与实现代码是否完全一致（特别是字符串字面量）
- 检查 `escapeHtml` 中 `&` 是否最先替换

---

## Step 5: 跑 lint

- [ ] 检查代码风格

Run:

```bash
cd super-tool-node
npm run lint
```

Expected: 无新错误。

---

## Step 6: Commit

- [ ] 提交

```bash
git add super-tool-node/app/lib/templateRenderer.ts super-tool-node/test/notification/lib/templateRenderer.test.ts
git commit -m "feat(notification): add lightweight template renderer with security against template injection

Implements {{var.path}} placeholder replacement with:
- HTML escape mode (default) for in_app/email channels
- Plain mode for SMS channel
- Nested path resolution (e.g., user.name)
- Missing variable detection (preserves placeholder literal)
- No recursive parsing (prevents template injection via user-supplied values)

Tests cover: 12 renderTemplate cases, 5 getByPath cases, 3 escapeHtml cases.

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.2)"
```

---

## Verification Checklist

- [ ] `app/lib/templateRenderer.ts` 已创建
- [ ] `test/notification/lib/templateRenderer.test.ts` 已创建
- [ ] 所有测试用例 PASS
- [ ] `npm run lint` 通过
- [ ] git commit 已提交

完成本 Task 后请进入 [`p1-04-migration.md`](./p1-04-migration.md)。
