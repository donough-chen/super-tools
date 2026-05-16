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
      expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
    });
    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });
  });
});
