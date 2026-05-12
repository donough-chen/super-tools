/**
 * userType utils 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 */
import {
  isSelf, USER_TYPE_LABELS, USER_STATUS_LABELS, GENDER_LABELS,
} from '@/utils/userType';

describe('userType utils', () => {
  it('isSelf returns true when target === current', () => {
    expect(isSelf(5, 5)).toBe(true);
  });

  it('isSelf returns false when target !== current or current undefined', () => {
    expect(isSelf(5, 6)).toBe(false);
    expect(isSelf(5, undefined)).toBe(false);
    expect(isSelf(5, 0 as any)).toBe(false);  // 0 视为未登录态
  });

  it('label maps cover full domain', () => {
    expect(USER_TYPE_LABELS[1]).toBe('普通用户');
    expect(USER_TYPE_LABELS[2]).toBe('管理员');
    expect(USER_STATUS_LABELS[0]).toBe('禁用');
    expect(USER_STATUS_LABELS[1]).toBe('正常');
    expect(GENDER_LABELS[0]).toBe('保密');
    expect(GENDER_LABELS[1]).toBe('男');
    expect(GENDER_LABELS[2]).toBe('女');
  });
});
