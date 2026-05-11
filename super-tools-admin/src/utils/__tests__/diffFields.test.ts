import { diffFields } from '@/utils/diffFields';

describe('diffFields', () => {
  it('正确识别 added / removed / changed + 跳过系统字段 + 嵌套对比', () => {
    // 1. 基础：changed + added + 跳过 createdAt/updatedAt
    const before = { name: 'A', age: 18, createdAt: '2026-01-01' };
    const after = { name: 'A', age: 20, email: 'a@b.com', updatedAt: '2026-05-11' };
    const result = diffFields(before, after);

    expect(result).toContainEqual({ key: 'age', before: 18, after: 20 });
    expect(result).toContainEqual({ key: 'email', before: undefined, after: 'a@b.com' });
    expect(result.find((d) => d.key === 'name')).toBeUndefined(); // 没变
    expect(result.find((d) => d.key === 'createdAt')).toBeUndefined(); // 系统字段
    expect(result.find((d) => d.key === 'updatedAt')).toBeUndefined();

    // 2. destroy 场景：only before
    const destroyResult = diffFields({ id: 1, name: 'A' }, null);
    expect(destroyResult).toEqual([
      { key: 'id', before: 1, after: undefined },
      { key: 'name', before: 'A', after: undefined },
    ]);

    // 3. 双 null
    expect(diffFields(null, null)).toEqual([]);
    expect(diffFields(undefined, undefined)).toEqual([]);

    // 4. 嵌套对象/数组：有差异
    const r2 = diffFields({ tags: ['a', 'b'] }, { tags: ['a', 'b', 'c'] });
    expect(r2).toEqual([{ key: 'tags', before: ['a', 'b'], after: ['a', 'b', 'c'] }]);

    // 5. 嵌套相同：不应出现在 diff 中
    const r3 = diffFields(
      { meta: { x: 1, y: 2 } },
      { meta: { x: 1, y: 2 } },
    );
    expect(r3).toEqual([]);

    // 6. create 场景：only after
    const createResult = diffFields(null, { id: 5, name: 'New' });
    expect(createResult).toEqual([
      { key: 'id', before: undefined, after: 5 },
      { key: 'name', before: undefined, after: 'New' },
    ]);
  });
});
