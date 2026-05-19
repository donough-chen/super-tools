/**
 * 动态受众规则 — 字段白名单
 *
 * 每个字段定义：
 * - table: 实际 DB 表名
 * - column: 实际列名
 * - type: 字段类型（string/number/date/boolean）
 * - label: 中文显示名
 * - ops: 支持的操作符列表
 * - joinClause: 如果不在 users 主表，需要的 JOIN 语句（user_id 关联）
 */

export interface FieldMeta {
  table: string;
  column: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  label: string;
  ops: string[];
  joinClause?: string | string[];
}

export const AUDIENCE_FIELDS: Record<string, FieldMeta> = {
  'user.status': {
    table: 'users', column: 'status', type: 'number', label: '用户状态',
    ops: ['eq', 'ne', 'in', 'nin'],
  },
  'user.created_at': {
    table: 'users', column: 'created_at', type: 'date', label: '注册时间',
    ops: ['gt', 'gte', 'lt', 'lte', 'between'],
  },
  'user.gender': {
    table: 'users', column: 'gender', type: 'number', label: '性别',
    ops: ['eq', 'ne', 'in'],
  },
  'member.level': {
    table: 'member_levels', column: 'level', type: 'number', label: '会员等级',
    ops: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'],
    joinClause: [
      'LEFT JOIN user_members ON user_members.user_id = users.id',
      'LEFT JOIN member_levels ON member_levels.id = user_members.level_id',
    ],
  },
  'member.is_paid': {
    table: 'user_members', column: 'is_paid', type: 'boolean', label: '是否付费会员',
    ops: ['eq'],
    joinClause: 'LEFT JOIN user_members ON user_members.user_id = users.id',
  },
  'member.paid_expire_at': {
    table: 'user_members', column: 'paid_expire_at', type: 'date', label: '付费会员到期时间',
    ops: ['gt', 'gte', 'lt', 'lte', 'between'],
    joinClause: 'LEFT JOIN user_members ON user_members.user_id = users.id',
  },
  'member.level_expire_at': {
    table: 'user_members', column: 'level_expire_at', type: 'date', label: '等级到期时间',
    ops: ['gt', 'gte', 'lt', 'lte', 'between'],
    joinClause: 'LEFT JOIN user_members ON user_members.user_id = users.id',
  },
  'profile.city': {
    table: 'user_profiles', column: 'city', type: 'string', label: '城市',
    ops: ['eq', 'ne', 'in', 'nin'],
    joinClause: 'LEFT JOIN user_profiles ON user_profiles.user_id = users.id',
  },
  'device.platform': {
    table: 'user_devices', column: 'platform', type: 'string', label: '设备平台',
    ops: ['eq', 'ne', 'in'],
    joinClause: 'LEFT JOIN user_devices ON user_devices.user_id = users.id',
  },
};

/**
 * 全部支持的操作符
 */
export const ALL_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'between'] as const;
export type Op = typeof ALL_OPS[number];
