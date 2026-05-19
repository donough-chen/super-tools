/**
 * 受众配置 - 配置示例
 *
 * 本文件提供受众管理页面的完整配置示例，供开发人员参考实现。
 * 对应后端服务：
 * - app/service/notification/audience.ts（受众解析）
 * - app/lib/audienceRuleCompiler.ts（规则编译）
 * - app/lib/audienceFieldWhitelist.ts（字段白名单）
 */

// ==================== 类型定义 ====================

/** 操作符类型 */
export type Op = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between';

/** 单个条件 */
export interface Condition {
  /** 字段标识（必须在白名单内） */
  field: string;
  /** 操作符 */
  op: Op;
  /** 比较值（类型取决于字段和操作符） */
  value: any;
}

/** 条件组（支持嵌套，最大 3 层） */
export interface Group {
  /** 组内逻辑关系 */
  operator: 'and' | 'or';
  /** 条件列表（可包含子组） */
  conditions: (Condition | Group)[];
}

/** 受众分组表单数据 */
export interface AudienceFormData {
  /** 分组名称 */
  name: string;
  /** 受众类型 */
  audienceType: 'all' | 'static' | 'dynamic';
  /** 动态规则（audienceType=dynamic 时必填） */
  dynamicRules?: Group;
  /** 静态用户 ID 列表（audienceType=static 时使用） */
  staticUserIds?: number[];
  /** 描述 */
  description?: string;
}

/** 字段元信息 */
export interface FieldOption {
  /** 字段标识 */
  field: string;
  /** 字段类型 */
  type: 'string' | 'number' | 'date' | 'boolean';
  /** 中文显示名 */
  label: string;
  /** 支持的操作符列表 */
  ops: Op[];
}

// ==================== 字段白名单（与后端同步） ====================

/**
 * 可用字段列表
 * 来源：app/lib/audienceFieldWhitelist.ts
 * 管理端通过 GET /admin/notification/audiences/fields 动态获取
 */
export const AUDIENCE_FIELDS: FieldOption[] = [
  { field: 'user.status', type: 'number', label: '用户状态', ops: ['eq', 'ne', 'in', 'nin'] },
  { field: 'user.created_at', type: 'date', label: '注册时间', ops: ['gt', 'gte', 'lt', 'lte', 'between'] },
  { field: 'user.gender', type: 'number', label: '性别', ops: ['eq', 'ne', 'in'] },
  { field: 'member.level_id', type: 'number', label: '会员等级', ops: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'] },
  { field: 'member.is_paid', type: 'boolean', label: '是否付费会员', ops: ['eq'] },
  { field: 'member.expire_at', type: 'date', label: '会员到期时间', ops: ['gt', 'gte', 'lt', 'lte', 'between'] },
  { field: 'profile.city', type: 'string', label: '城市', ops: ['eq', 'ne', 'in', 'nin'] },
  { field: 'device.platform', type: 'string', label: '设备平台', ops: ['eq', 'ne', 'in'] },
];

// ==================== 操作符配置 ====================

/** 操作符显示名和值类型说明 */
export const OP_CONFIG: Record<Op, { label: string; valueType: string; placeholder: string }> = {
  eq: { label: '等于', valueType: 'single', placeholder: '输入值' },
  ne: { label: '不等于', valueType: 'single', placeholder: '输入值' },
  gt: { label: '大于', valueType: 'single', placeholder: '输入值' },
  gte: { label: '大于等于', valueType: 'single', placeholder: '输入值或相对时间如 P30D' },
  lt: { label: '小于', valueType: 'single', placeholder: '输入值' },
  lte: { label: '小于等于', valueType: 'single', placeholder: '输入值或相对时间如 P7D' },
  in: { label: '包含于', valueType: 'array', placeholder: '逗号分隔多个值' },
  nin: { label: '不包含于', valueType: 'array', placeholder: '逗号分隔多个值' },
  between: { label: '区间', valueType: 'range', placeholder: '最小值,最大值' },
};

// ==================== 相对时间说明 ====================

/**
 * 日期字段支持相对时间格式（ISO 8601 Duration）
 * 格式：P{数字}{单位}
 * - D = 天
 * - H = 小时
 * - M = 分钟
 *
 * 含义：相对于当前时间往前推算
 * 例如 P30D 表示 "30天前"，编译为 SQL: NOW() - INTERVAL 30 DAY
 */
export const RELATIVE_TIME_PRESETS = [
  { label: '1小时前', value: 'P1H' },
  { label: '24小时前', value: 'P24H' },
  { label: '7天前', value: 'P7D' },
  { label: '14天前', value: 'P14D' },
  { label: '30天前', value: 'P30D' },
  { label: '90天前', value: 'P90D' },
  { label: '180天前', value: 'P180D' },
  { label: '365天前', value: 'P365D' },
];

// ==================== 规则配置示例 ====================

/**
 * 示例 1：付费会员即将到期（7天内）
 *
 * 场景：续费提醒推送
 * SQL 等价：WHERE user_members.is_paid = 1
 *           AND user_members.expire_at <= NOW() + INTERVAL 7 DAY
 *           AND user_members.expire_at > NOW()
 */
export const EXAMPLE_EXPIRING_MEMBERS: AudienceFormData = {
  name: '即将到期的付费会员（7天内）',
  audienceType: 'dynamic',
  dynamicRules: {
    operator: 'and',
    conditions: [
      { field: 'member.is_paid', op: 'eq', value: true },
      { field: 'member.expire_at', op: 'lte', value: 'P7D' },
      { field: 'member.expire_at', op: 'gt', value: 'P0D' },
    ],
  },
  description: '付费会员且到期时间在未来7天内，用于续费提醒',
};

/**
 * 示例 2：新注册用户（30天内）+ 特定城市
 *
 * 场景：新用户引导推送，针对一线城市
 */
export const EXAMPLE_NEW_USERS_IN_CITIES: AudienceFormData = {
  name: '一线城市新用户（30天内注册）',
  audienceType: 'dynamic',
  dynamicRules: {
    operator: 'and',
    conditions: [
      { field: 'user.created_at', op: 'gte', value: 'P30D' },
      { field: 'profile.city', op: 'in', value: ['北京', '上海', '广州', '深圳'] },
    ],
  },
  description: '30天内注册的一线城市用户，用于新手引导',
};

/**
 * 示例 3：高价值用户 OR VIP（嵌套规则）
 *
 * 场景：高端活动邀请
 * 逻辑：(等级≥3 且 付费) 或 (注册超1年 且 移动端)
 */
export const EXAMPLE_HIGH_VALUE_USERS: AudienceFormData = {
  name: '高价值用户群',
  audienceType: 'dynamic',
  dynamicRules: {
    operator: 'or',
    conditions: [
      {
        operator: 'and',
        conditions: [
          { field: 'member.level_id', op: 'gte', value: 3 },
          { field: 'member.is_paid', op: 'eq', value: true },
        ],
      },
      {
        operator: 'and',
        conditions: [
          { field: 'user.created_at', op: 'lte', value: 'P365D' },
          { field: 'device.platform', op: 'in', value: ['ios', 'android'] },
        ],
      },
    ],
  },
  description: '高等级付费会员 或 老用户移动端用户，用于高端活动邀请',
};

/**
 * 示例 4：排除特定群体
 *
 * 场景：活跃用户推送，排除未完善资料和纯 Web 用户
 */
export const EXAMPLE_ACTIVE_MOBILE_USERS: AudienceFormData = {
  name: '活跃移动端用户（已完善资料）',
  audienceType: 'dynamic',
  dynamicRules: {
    operator: 'and',
    conditions: [
      { field: 'user.status', op: 'eq', value: 1 },
      { field: 'user.gender', op: 'ne', value: 0 },
      { field: 'device.platform', op: 'nin', value: ['web'] },
    ],
  },
  description: '活跃状态、已填写性别、非纯Web用户',
};

/**
 * 示例 5：静态用户列表
 *
 * 场景：测试发送、精准推送
 */
export const EXAMPLE_STATIC_AUDIENCE: AudienceFormData = {
  name: '内部测试用户',
  audienceType: 'static',
  staticUserIds: [1, 2, 3, 10, 15],
  description: '内部测试账号，用于功能验证',
};

// ==================== 表单验证规则 ====================

export const AUDIENCE_FORM_RULES = {
  name: [
    { required: true, message: '请输入受众名称' },
    { max: 50, message: '名称不超过50字符' },
  ],
  audienceType: [{ required: true, message: '请选择受众类型' }],
};

/**
 * 验证动态规则是否有效
 * @returns 错误信息，null 表示有效
 */
export function validateDynamicRules(rules: Group): string | null {
  if (!rules || !rules.conditions || rules.conditions.length === 0) {
    return '请至少添加一个筛选条件';
  }

  for (const cond of rules.conditions) {
    if ('operator' in cond && 'conditions' in cond) {
      // 递归验证子组
      const subError = validateDynamicRules(cond as Group);
      if (subError) return subError;
    } else {
      const c = cond as Condition;
      if (!c.field) return '请选择筛选字段';
      if (!c.op) return `字段 "${c.field}" 请选择操作符`;
      if (c.value === '' || c.value === null || c.value === undefined) {
        return `字段 "${c.field}" 请填写比较值`;
      }
    }
  }
  return null;
}

// ==================== 值输入辅助 ====================

/** 根据字段类型和操作符，解析用户输入的值 */
export function parseConditionValue(field: FieldOption, op: Op, rawValue: string): any {
  // 数组类型操作符
  if (op === 'in' || op === 'nin') {
    const parts = rawValue.split(',').map(s => s.trim()).filter(Boolean);
    if (field.type === 'number') return parts.map(Number);
    return parts;
  }

  // 区间类型
  if (op === 'between') {
    const parts = rawValue.split(',').map(s => s.trim());
    if (parts.length !== 2) return [rawValue, rawValue];
    if (field.type === 'number') return parts.map(Number);
    return parts;
  }

  // 单值
  switch (field.type) {
    case 'number': return Number(rawValue);
    case 'boolean': return rawValue === 'true' || rawValue === '1';
    default: return rawValue;
  }
}

// ==================== 受众数据导入说明 ====================

/**
 * 静态受众导入方式：
 *
 * 1. 手动输入：在管理端输入逗号分隔的用户 ID
 *    示例：1,2,3,101,205
 *
 * 2. API 传入：通过接口传入 staticUserIds 数组
 *    POST /admin/notification/audiences
 *    { "audienceType": "static", "staticUserIds": [1, 2, 3] }
 *
 * 3. 任务创建时指定：
 *    POST /admin/notification/tasks
 *    { "audienceType": "static", "staticUserIds": [101, 102] }
 *
 * 数据校验规则：
 * - 用户 ID 必须为正整数（> 0）
 * - 无效 ID 会被自动过滤
 * - 建议单次不超过 10000 个用户
 * - 动态规则只查询 status=1 的活跃用户
 */
export const IMPORT_TIPS = {
  manual: '直接输入用户 ID，多个用逗号分隔（如：1,2,3,101）',
  limit: '建议单次不超过 10000 个用户 ID',
  validation: '系统会自动过滤无效 ID（非正整数）',
  dynamic: '动态规则每次执行时实时计算，只包含活跃用户（status=1）',
};
