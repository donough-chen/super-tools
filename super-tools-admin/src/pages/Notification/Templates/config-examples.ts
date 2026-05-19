/**
 * 通知模板编辑 - 配置示例
 *
 * 本文件提供模板编辑页面的完整配置示例，供开发人员参考实现。
 * 对应后端接口：app/controller/admin/notification/template.ts
 */

// ==================== 类型定义 ====================

/** 模板渠道类型 */
export type Channel = 'in_app' | 'email' | 'sms';

/** 模板状态 */
export type TemplateStatus = 0 | 1 | 2; // 0=草稿, 1=已发布, 2=已停用

/** 模板创建/编辑表单数据 */
export interface TemplateFormData {
  /** 关联通知类型 ID */
  typeId: number;
  /** 模板唯一编码（建议格式：snake_case，如 order_shipped） */
  code: string;
  /** 模板显示名称 */
  name: string;
  /** 发送渠道 */
  channel: Channel;
  /** 标题模板（支持 {{variable}} 占位符） */
  titleTemplate?: string;
  /** 内容模板（支持 {{variable}} 占位符） */
  contentTemplate: string;
  /** 扩展配置 */
  extraConfig?: ExtraConfig;
  /** 示例变量（用于预览） */
  sampleVariables?: Record<string, any>;
  /** 模板描述 */
  description?: string;
}

/** 邮件渠道扩展配置 */
export interface EmailExtraConfig {
  layout?: 'default' | 'minimal' | 'marketing';
  headerLogo?: string;
  footerText?: string;
  replyTo?: string;
  /** 是否使用 HTML 富文本 */
  useHtml?: boolean;
}

/** 短信渠道扩展配置 */
export interface SmsExtraConfig {
  /** 短信签名 */
  signName?: string;
  /** 第三方平台模板编码 */
  templateCode?: string;
}

/** 站内信扩展配置 */
export interface InAppExtraConfig {
  /** 跳转链接 */
  actionUrl?: string;
  /** 图标类型 */
  iconType?: 'info' | 'success' | 'warning' | 'error';
}

export type ExtraConfig = EmailExtraConfig | SmsExtraConfig | InAppExtraConfig;

// ==================== 配置示例 ====================

/**
 * 示例 1：站内信模板 - 订单发货通知
 */
export const EXAMPLE_IN_APP_TEMPLATE: TemplateFormData = {
  typeId: 1,
  code: 'order_shipped',
  name: '订单发货通知',
  channel: 'in_app',
  titleTemplate: '你的订单 {{order.no}} 已发货',
  contentTemplate: '亲爱的 {{user.name}}，你的订单 {{order.no}} 已由 {{logistics.company}} 发出，运单号：{{logistics.trackingNo}}。预计 {{logistics.estimatedDate}} 送达。',
  extraConfig: {
    actionUrl: '/orders/{{order.id}}',
    iconType: 'success',
  } as InAppExtraConfig,
  sampleVariables: {
    user: { name: '张三' },
    order: { no: 'ORD20260519001', id: 12345 },
    logistics: {
      company: '顺丰速运',
      trackingNo: 'SF1234567890',
      estimatedDate: '2026-05-21',
    },
  },
  description: '用户订单发货后推送站内信通知',
};

/**
 * 示例 2：邮件模板 - 会员到期提醒
 */
export const EXAMPLE_EMAIL_TEMPLATE: TemplateFormData = {
  typeId: 2,
  code: 'member_expire_reminder',
  name: '会员到期提醒',
  channel: 'email',
  titleTemplate: '{{user.name}}，你的 {{member.levelName}} 会员即将到期',
  contentTemplate: `尊敬的 {{user.name}}：

你的 {{member.levelName}} 会员将于 {{member.expireDate}} 到期。

续费可享受以下权益：
- {{benefit.item1}}
- {{benefit.item2}}
- {{benefit.item3}}

立即续费享 {{promotion.discount}} 优惠：{{promotion.url}}

如有疑问请联系客服。`,
  extraConfig: {
    layout: 'marketing',
    headerLogo: 'https://cdn.example.com/logo.png',
    footerText: '© 2026 Super Tools | 退订请点击此处',
    replyTo: 'support@example.com',
    useHtml: true,
  } as EmailExtraConfig,
  sampleVariables: {
    user: { name: '李四' },
    member: { levelName: '黄金', expireDate: '2026-06-01' },
    benefit: { item1: '无限次导出', item2: '优先客服', item3: '专属折扣' },
    promotion: { discount: '8折', url: 'https://app.example.com/renew' },
  },
  description: '会员到期前 7 天发送续费提醒邮件',
};

/**
 * 示例 3：短信模板 - 验证码
 */
export const EXAMPLE_SMS_TEMPLATE: TemplateFormData = {
  typeId: 3,
  code: 'verification_code',
  name: '验证码短信',
  channel: 'sms',
  // 短信通常不需要标题
  contentTemplate: '【超级工具】你的验证码是 {{code}}，{{expireMinutes}} 分钟内有效。如非本人操作请忽略。',
  extraConfig: {
    signName: '超级工具',
    templateCode: 'SMS_VERIFY_001',
  } as SmsExtraConfig,
  sampleVariables: {
    code: '123456',
    expireMinutes: 5,
  },
  description: '用户登录/注册验证码短信',
};

// ==================== 表单验证规则 ====================

/** 模板编码验证：仅允许小写字母、数字、下划线 */
export const CODE_PATTERN = /^[a-z][a-z0-9_]{2,50}$/;

/** 模板表单验证规则 */
export const TEMPLATE_FORM_RULES = {
  typeId: [{ required: true, message: '请选择通知类型' }],
  code: [
    { required: true, message: '请输入模板编码' },
    { pattern: CODE_PATTERN, message: '编码格式：小写字母开头，仅含小写字母/数字/下划线，3-50字符' },
  ],
  name: [
    { required: true, message: '请输入模板名称' },
    { max: 50, message: '名称不超过50字符' },
  ],
  channel: [{ required: true, message: '请选择渠道' }],
  contentTemplate: [
    { required: true, message: '请输入内容模板' },
    { max: 5000, message: '内容模板不超过5000字符' },
  ],
  titleTemplate: [
    { max: 200, message: '标题模板不超过200字符' },
  ],
};

// ==================== 变量提取工具 ====================

/**
 * 从模板字符串中提取所有变量占位符
 * @example extractVariables('你好 {{user.name}}，订单 {{order.no}}')
 * // => ['user.name', 'order.no']
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{([\w.]+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

/**
 * 验证模板语法是否合法
 * @returns 错误信息数组，空数组表示合法
 */
export function validateTemplateSyntax(template: string): string[] {
  const errors: string[] = [];

  // 检查未闭合的占位符
  const openCount = (template.match(/\{\{/g) || []).length;
  const closeCount = (template.match(/\}\}/g) || []).length;
  if (openCount !== closeCount) {
    errors.push(`占位符未正确闭合：发现 ${openCount} 个 {{ 和 ${closeCount} 个 }}`);
  }

  // 检查非法字符的占位符
  const invalidMatches = template.match(/\{\{[^}]*[^}\w.][^}]*\}\}/g);
  if (invalidMatches) {
    errors.push(`包含非法占位符：${invalidMatches.join(', ')}（仅支持字母/数字/下划线/点号）`);
  }

  return errors;
}

// ==================== 渠道配置选项 ====================

export const CHANNEL_OPTIONS = [
  { label: '站内信', value: 'in_app', description: '应用内消息通知，支持 HTML 转义' },
  { label: '邮件', value: 'email', description: '电子邮件通知，支持 HTML 富文本' },
  { label: '短信', value: 'sms', description: '手机短信通知，纯文本无转义' },
];

/** 各渠道的模板编辑提示 */
export const CHANNEL_TIPS: Record<Channel, string> = {
  in_app: '站内信模板：变量值会自动 HTML 转义，可使用 {{variable.path}} 嵌套路径',
  email: '邮件模板：支持多行文本，变量值自动 HTML 转义。如需富文本请在 extraConfig 中设置 useHtml: true',
  sms: '短信模板：纯文本，变量值不转义。注意短信字数限制（单条70字/长短信67字一条）',
};
