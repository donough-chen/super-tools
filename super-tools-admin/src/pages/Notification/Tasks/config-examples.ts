/**
 * 通知发送任务 - 配置示例
 *
 * 本文件提供任务创建页面的完整配置示例，供开发人员参考实现。
 * 对应后端服务：app/service/notification/task-scheduler.ts
 */

// ==================== 类型定义 ====================

/** 发送类型 */
export type SendType = 'immediate' | 'scheduled' | 'cron' | 'rrule';

/** 任务状态 */
export type TaskStatus = 'pending' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

/** 受众类型 */
export type AudienceType = 'all' | 'static' | 'dynamic';

/** 任务创建表单数据 */
export interface TaskFormData {
  /** 任务名称 */
  name: string;
  /** 通知类型 ID */
  typeId: number;
  /** 模板编码 */
  templateCode: string;
  /** 发送渠道 */
  channels: ('in_app' | 'email' | 'sms')[];
  /** 受众类型 */
  audienceType: AudienceType;
  /** 静态用户 ID 列表（audienceType=static 时使用） */
  staticUserIds?: number[];
  /** 动态规则（audienceType=dynamic 时使用，引用已保存的受众分组） */
  audienceId?: number;
  /** 模板变量 */
  variables: Record<string, any>;
  /** 发送类型 */
  sendType: SendType;
  /** 定时发送时间（ISO 8601） */
  scheduledAt?: string;
  /** Cron 表达式 */
  cronExpression?: string;
  /** RRULE 规则字符串 */
  rrule?: string;
  /** 撤销窗口（秒），仅 immediate 有效 */
  undoWindowSec?: number;
  /** 优先级 1-5，默认 2 */
  priority?: number;
  /** 任务描述 */
  description?: string;
}

// ==================== 配置示例 ====================

/**
 * 示例 1：立即发送 - 全站公告
 *
 * 场景：新功能上线，立即通知所有用户
 * 特点：设置 60 秒撤销窗口，发现问题可及时撤回
 */
export const EXAMPLE_IMMEDIATE_TASK: TaskFormData = {
  name: '新功能上线通知 - AI 助手',
  typeId: 1,
  templateCode: 'feature_launch',
  channels: ['in_app', 'email'],
  audienceType: 'all',
  variables: {
    feature: { name: 'AI 助手', url: 'https://app.example.com/ai' },
    app: { name: 'Super Tools' },
  },
  sendType: 'immediate',
  undoWindowSec: 60,
  priority: 2,
  description: 'V2.5 新功能上线通知，60秒内可撤销',
};

/**
 * 示例 2：定时发送 - 活动预热
 *
 * 场景：活动开始前一天发送提醒
 * 注意：scheduledAt 必须在当前时间 30 秒之后
 */
export const EXAMPLE_SCHEDULED_TASK: TaskFormData = {
  name: '年中大促预热通知',
  typeId: 3,
  templateCode: 'event_reminder',
  channels: ['in_app', 'sms'],
  audienceType: 'static',
  staticUserIds: [101, 102, 103, 205, 308, 412, 567, 890],
  variables: {
    event: { name: '年中大促', startTime: '2026-06-01 10:00' },
    coupon: { code: 'MID2026', discount: '8折' },
  },
  sendType: 'scheduled',
  scheduledAt: '2026-05-31T18:00:00+08:00',
  priority: 3,
  description: '活动前一天 18:00 发送预热短信和站内信',
};

/**
 * 示例 3：Cron 周期任务 - 每日签到提醒
 *
 * 场景：每天早上 8 点提醒用户签到
 * Cron 格式：秒 分 时 日 月 周（标准 5 位）
 */
export const EXAMPLE_CRON_TASK: TaskFormData = {
  name: '每日签到提醒',
  typeId: 5,
  templateCode: 'daily_checkin',
  channels: ['in_app'],
  audienceType: 'dynamic',
  // 动态受众：引用已保存的受众分组
  audienceId: 3,
  variables: {
    app: { name: 'Super Tools' },
    reward: { points: 10, streak_bonus: 5 },
  },
  sendType: 'cron',
  cronExpression: '0 8 * * *', // 每天 08:00
  priority: 1,
  description: '每天早上 8 点推送签到提醒（低优先级）',
};

/**
 * 示例 4：RRULE 复杂规则 - 双周会议提醒
 *
 * 场景：每两周一次的 Sprint Review 会议提醒
 * RRULE 参考：RFC 5545
 */
export const EXAMPLE_RRULE_TASK: TaskFormData = {
  name: '双周 Sprint Review 提醒',
  typeId: 2,
  templateCode: 'meeting_reminder',
  channels: ['email', 'in_app'],
  audienceType: 'static',
  staticUserIds: [1, 2, 3, 4, 5, 6, 7, 8],
  variables: {
    meeting: {
      topic: 'Sprint Review',
      location: '3楼会议室 A',
      duration: '1小时',
      agenda_url: 'https://wiki.example.com/sprint-review',
    },
  },
  sendType: 'rrule',
  rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;BYHOUR=9;BYMINUTE=0',
  priority: 2,
  description: '每两周周一 9:00 发送会议提醒',
};

// ==================== 常用 Cron 表达式参考 ====================

export const COMMON_CRON_EXPRESSIONS = [
  { label: '每天 8:00', value: '0 8 * * *', description: '每天早上 8 点' },
  { label: '每天 12:00', value: '0 12 * * *', description: '每天中午 12 点' },
  { label: '每天 20:00', value: '0 20 * * *', description: '每天晚上 8 点' },
  { label: '每周一 9:00', value: '0 9 * * 1', description: '每周一早上 9 点' },
  { label: '每周五 17:00', value: '0 17 * * 5', description: '每周五下午 5 点' },
  { label: '每月1号 10:00', value: '0 10 1 * *', description: '每月 1 号上午 10 点' },
  { label: '工作日 9:00', value: '0 9 * * 1-5', description: '周一至周五早上 9 点' },
  { label: '每小时整点', value: '0 * * * *', description: '每小时的第 0 分钟' },
];

// ==================== 表单验证规则 ====================

export const TASK_FORM_RULES = {
  name: [
    { required: true, message: '请输入任务名称' },
    { max: 100, message: '名称不超过100字符' },
  ],
  typeId: [{ required: true, message: '请选择通知类型' }],
  templateCode: [{ required: true, message: '请输入模板编码' }],
  channels: [{ required: true, type: 'array' as const, min: 1, message: '请至少选择一个渠道' }],
  audienceType: [{ required: true, message: '请选择受众类型' }],
  sendType: [{ required: true, message: '请选择发送类型' }],
  scheduledAt: [{ required: true, message: '请选择定时发送时间' }],
  cronExpression: [
    { required: true, message: '请输入 Cron 表达式' },
    { pattern: /^(\S+\s+){4}\S+$/, message: 'Cron 格式不正确（5位：分 时 日 月 周）' },
  ],
  rrule: [
    { required: true, message: '请输入 RRULE 规则' },
    { pattern: /^FREQ=/, message: 'RRULE 必须以 FREQ= 开头' },
  ],
  variables: [
    {
      validator: (_: any, value: string) => {
        if (!value || value.trim() === '{}') return Promise.resolve();
        try { JSON.parse(value); return Promise.resolve(); }
        catch { return Promise.reject(new Error('变量必须是合法的 JSON 格式')); }
      },
    },
  ],
  undoWindowSec: [
    { type: 'number' as const, min: 10, max: 300, message: '撤销窗口：10-300秒' },
  ],
  priority: [
    { type: 'number' as const, min: 1, max: 5, message: '优先级范围：1-5' },
  ],
};

// ==================== 发送类型选项 ====================

export const SEND_TYPE_OPTIONS = [
  {
    label: '立即发送',
    value: 'immediate',
    description: '创建后立即执行（可配置撤销窗口）',
    tip: '设置撤销窗口后，在窗口期内可撤回任务',
  },
  {
    label: '定时发送',
    value: 'scheduled',
    description: '指定时间点执行',
    tip: '定时时间必须在当前时间 30 秒之后',
  },
  {
    label: 'Cron 周期',
    value: 'cron',
    description: '按 Cron 表达式周期性执行',
    tip: '格式：分 时 日 月 周（如 0 8 * * * 表示每天8点）',
  },
  {
    label: 'RRULE 规则',
    value: 'rrule',
    description: '按 RFC 5545 RRULE 规则执行',
    tip: '适用于复杂重复规则（如每两周、每月最后一个工作日等）',
  },
];

// ==================== 任务状态配置 ====================

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; actions: string[] }> = {
  pending: { label: '等待中', color: 'default', actions: ['cancel'] },
  scheduled: { label: '已调度', color: 'blue', actions: ['cancel', 'undo'] },
  running: { label: '执行中', color: 'processing', actions: ['pause', 'cancel'] },
  paused: { label: '已暂停', color: 'warning', actions: ['resume', 'cancel'] },
  completed: { label: '已完成', color: 'success', actions: [] },
  failed: { label: '失败', color: 'error', actions: [] },
  canceled: { label: '已取消', color: 'default', actions: [] },
};
