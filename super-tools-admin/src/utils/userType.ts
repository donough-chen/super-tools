/**
 * 注册来源 / 状态 / 性别 标签映射 + 自身保护工具
 */

/** @deprecated 已废弃，使用 REGISTER_SOURCE_LABELS 替代 */
export const USER_TYPE_LABELS: Record<number, string> = {
  1: '普通用户',
  2: '管理员',
};

/** 注册来源平台标签（对应 oauth_clients.platform） */
export const REGISTER_SOURCE_LABELS: Record<string, string> = {
  web: '官网PC端',
  h5: '移动H5端',
  miniprogram: '微信小程序',
  ios: 'iOS App',
  android: 'Android App',
  admin: '管理后台',
  email: '邮箱注册',
  phone: '手机号注册',
};

/** 注册来源选项（用于下拉筛选） */
export const REGISTER_SOURCE_OPTIONS = [
  { label: '官网PC端', value: 'web' },
  { label: '移动H5端', value: 'h5' },
  { label: '微信小程序', value: 'miniprogram' },
  { label: 'iOS App', value: 'ios' },
  { label: 'Android App', value: 'android' },
  { label: '管理后台', value: 'admin' },
  { label: '邮箱注册', value: 'email' },
  { label: '手机号注册', value: 'phone' },
];

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
