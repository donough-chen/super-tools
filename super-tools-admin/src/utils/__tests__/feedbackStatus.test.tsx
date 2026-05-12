/**
 * feedbackStatus utils 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 *
 * 验证状态机白名单与后端 service.feedback._isStatusTransitionAllowed 完全一致。
 */
import {
  getAllowedTransitions, isTransitionAllowed,
  STATUS_LABELS, STATUS_TRANSITIONS,
} from '@/utils/feedbackStatus';

describe('feedbackStatus utils', () => {
  it('getAllowedTransitions(0) → [1, 3]（待处理→处理中/关闭）', () => {
    expect(getAllowedTransitions(0)).toEqual([1, 3]);
  });

  it('getAllowedTransitions on unknown status returns []', () => {
    expect(getAllowedTransitions(99)).toEqual([]);
  });

  it('isTransitionAllowed(0, 2) is false（reply 独占 0/1→2）', () => {
    expect(isTransitionAllowed(0, 1)).toBe(true);
    expect(isTransitionAllowed(0, 3)).toBe(true);
    expect(isTransitionAllowed(0, 2)).toBe(false);   // reply 独占
    expect(isTransitionAllowed(1, 2)).toBe(false);   // reply 独占
  });

  it('idempotent: from === to always allowed', () => {
    expect(isTransitionAllowed(2, 2)).toBe(true);
    expect(isTransitionAllowed(3, 3)).toBe(true);
    expect(STATUS_LABELS[2]).toBe('已回复');
    expect(STATUS_LABELS[3]).toBe('已关闭');
  });

  it('TRANSITIONS table covers all 4 known states', () => {
    expect(STATUS_TRANSITIONS[0]).toBeDefined();
    expect(STATUS_TRANSITIONS[1]).toBeDefined();
    expect(STATUS_TRANSITIONS[2]).toBeDefined();
    expect(STATUS_TRANSITIONS[3]).toBeDefined();
  });
});
