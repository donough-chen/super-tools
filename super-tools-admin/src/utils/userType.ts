/**
 * 用户类型 / 状态 / 性别 标签映射 + 自身保护工具
 */
export const USER_TYPE_LABELS: Record<number, string> = {
  1: '普通用户',
  2: '管理员',
};

export const USER_STATUS_LABELS: Record<number, string> = {
  0: '禁用',
  1: '正常',
};

export const GENDER_LABELS: Record<number, string> = {
  0: '保密',
  1: '男',
  2: '女',
};

/** 判断是否当前登录用户自身（用于操作列禁用） */
export function isSelf(targetUserId: number, currentUserId?: number): boolean {
  return !!currentUserId && targetUserId === currentUserId;
}
