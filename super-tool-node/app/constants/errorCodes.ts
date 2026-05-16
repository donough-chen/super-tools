/**
 * 统一错误码定义
 */
export const ErrorCodes = {
  // 通用错误 1xxxxx
  SUCCESS: { code: 200, message: 'success' },
  BAD_REQUEST: { code: 400, message: '请求参数错误' },
  UNAUTHORIZED: { code: 401, message: '未授权' },
  FORBIDDEN: { code: 403, message: '权限不足' },
  NOT_FOUND: { code: 404, message: '资源不存在' },
  VALIDATION_ERROR: { code: 422, message: '参数验证失败' },
  TOO_MANY_REQUESTS: { code: 429, message: '请求过于频繁' },
  INTERNAL_ERROR: { code: 500, message: '服务器内部错误' },

  // 认证错误 1001xx
  LOGIN_FAILED: { code: 100101, message: '用户名或密码错误' },
  TOKEN_EXPIRED: { code: 100102, message: 'Token已过期' },
  TOKEN_INVALID: { code: 100103, message: 'Token无效' },
  ACCOUNT_DISABLED: { code: 100104, message: '账号已被禁用' },
  ACCOUNT_LOCKED: { code: 100105, message: '账号已被锁定' },

  // 用户错误 1002xx
  USER_NOT_FOUND: { code: 100201, message: '用户不存在' },
  USERNAME_EXISTS: { code: 100202, message: '用户名已存在' },
  EMAIL_EXISTS: { code: 100203, message: '邮箱已被注册' },
  PASSWORD_WRONG: { code: 100204, message: '原密码错误' },
  PHONE_EXISTS: { code: 100205, message: '手机号已被注册' },

  // 验证码错误 1003xx
  VERIFY_CODE_INVALID: { code: 100301, message: '验证码错误或已过期' },
  VERIFY_CODE_USED: { code: 100302, message: '验证码已使用' },
  VERIFY_CODE_SEND_TOO_FAST: { code: 100303, message: '验证码发送过于频繁，请60秒后重试' },
  VERIFY_CODE_DAILY_LIMIT: { code: 100304, message: '今日验证码发送次数已达上限' },
  VERIFY_CODE_IP_LIMIT: { code: 100305, message: '当前IP发送验证码过于频繁' },

  // 微信登录错误 1004xx
  WECHAT_CODE_INVALID: { code: 100401, message: '微信授权码无效' },
  WECHAT_SESSION_FAILED: { code: 100402, message: '微信登录会话获取失败' },
  WECHAT_OAUTH_FAILED: { code: 100403, message: '微信OAuth授权失败' },
  WECHAT_USERINFO_FAILED: { code: 100404, message: '微信用户信息获取失败' },
  WECHAT_PLATFORM_INVALID: { code: 100405, message: '不支持的微信登录平台' },

  // 账号绑定错误 1005xx
  BIND_ALREADY_EXISTS: { code: 100501, message: '该账号已被其他用户绑定' },
  BIND_SELF_EXISTS: { code: 100502, message: '您已绑定该类型账号' },
  UNBIND_LAST_METHOD: { code: 100503, message: '不能解绑最后一种登录方式' },
  UNBIND_NOT_FOUND: { code: 100504, message: '未找到该绑定关系' },

  // 安全错误 1006xx
  LOGIN_CAPTCHA_REQUIRED: { code: 100601, message: '登录失败次数过多，请输入验证码' },
  LOGIN_TEMP_LOCKED: { code: 100602, message: '账号已被临时锁定，请稍后重试' },
  LOGIN_PERMANENT_LOCKED: { code: 100603, message: '账号已被永久锁定，请联系管理员' },
  LOGIN_ABNORMAL_LOCATION: { code: 100604, message: '检测到异地登录，请进行安全验证' },
  CLIENT_INVALID: { code: 100605, message: '无效的客户端' },
  CLIENT_SECRET_WRONG: { code: 100606, message: '客户端密钥错误' },

  // 会员错误 1007xx
  MEMBER_NOT_FOUND: { code: 100701, message: '会员记录不存在' },
  MEMBER_DAILY_SIGNED: { code: 100702, message: '今日已签到' },
  MEMBER_POINTS_INSUFFICIENT: { code: 100703, message: '积分余额不足' },
  MEMBER_LEVEL_NOT_FOUND: { code: 100704, message: '等级不存在' },
  MEMBER_PLAN_NOT_FOUND: { code: 100705, message: '套餐不存在' },
  MEMBER_ALREADY_PAID: { code: 100706, message: '付费会员尚未过期' },

  // 工具模块错误 1008xx
  TOOL_NOT_FOUND: { code: 100801, message: '工具不存在' },
  TOOL_OFFLINE: { code: 100802, message: '工具已下架' },
  TOOL_CODE_EXISTS: { code: 100803, message: '工具编码已存在' },
  TOOL_CATEGORY_NOT_FOUND: { code: 100804, message: '分类不存在' },
  TOOL_CATEGORY_CODE_EXISTS: { code: 100805, message: '分类编码已存在' },
  TOOL_CATEGORY_HAS_TOOLS: { code: 100806, message: '该分类下尚有工具，请先移除或删除后再操作' },
  TOOL_ACCESS_NEED_LEVEL: { code: 100807, message: '当前等级不足' },
  TOOL_ACCESS_NEED_PAID: { code: 100808, message: '需要付费会员' },
  TOOL_ACCESS_PAID_EXPIRED: { code: 100809, message: '付费会员已过期' },

  // 收藏工具错误 1009xx
  FAVORITE_TOOL_NOT_AVAILABLE: { code: 100901, message: '工具不存在或已下架' },
  FAVORITE_ALREADY_EXISTS: { code: 100902, message: '已收藏过该工具' },
  FAVORITE_NOT_FOUND: { code: 100903, message: '收藏记录不存在' },
  FAVORITE_REORDER_MISMATCH: { code: 100904, message: '排序参数与当前收藏列表不匹配' },

  // 通知模块错误 108xxx
  // 模板相关 108001-108099
  NOTIFY_TEMPLATE_NOT_FOUND: { code: 108001, message: '模板不存在' },
  NOTIFY_TEMPLATE_NOT_PUBLISHED: { code: 108002, message: '模板未发布' },
  NOTIFY_TEMPLATE_HAS_TASKS: { code: 108003, message: '模板已被关联任务，不可删除' },
  NOTIFY_TEMPLATE_VAR_MISSING: { code: 108004, message: '模板渲染失败：变量缺失' },
  NOTIFY_TEMPLATE_SYNTAX: { code: 108005, message: '模板渲染失败：语法错误' },
  // 类型相关 108101-108199
  NOTIFY_TYPE_NOT_FOUND: { code: 108101, message: '通知类型不存在' },
  NOTIFY_TYPE_SYSTEM_LOCKED: { code: 108102, message: '系统内置类型不可修改/删除' },
  NOTIFY_TYPE_DISABLED: { code: 108103, message: '通知类型已停用' },
  NOTIFY_TYPE_KEY_DUPLICATED: { code: 108110, message: 'typeKey 已存在' },
  NOTIFY_TYPE_IN_USE: { code: 108111, message: '该类型仍有关联模板，禁止删除（请先停用）' },
  NOTIFY_TEMPLATE_ACTIVE_LOCKED: { code: 108112, message: '已启用模板不可直接修改，请创建新草稿' },
  // 受众相关 108201-108299
  NOTIFY_AUDIENCE_DYNAMIC_NOT_IMPL: { code: 108201, message: '动态受众解析能力 P2 提供' },
  NOTIFY_AUDIENCE_TYPE_INVALID: { code: 108202, message: '不支持的受众类型' },
  NOTIFY_AUDIENCE_NOT_FOUND: { code: 108210, message: '受众分组不存在' },
  NOTIFY_AUDIENCE_FIELD_INVALID: { code: 108211, message: '受众规则字段不在白名单' },
  NOTIFY_AUDIENCE_OP_INVALID: { code: 108212, message: '受众规则操作符非法' },
  // 任务相关 108301-108399
  NOTIFY_TASK_NOT_FOUND: { code: 108301, message: '任务不存在' },
  NOTIFY_TASK_STATUS_INVALID: { code: 108302, message: '任务状态不允许此操作' },
  NOTIFY_TASK_SCHEDULE_TOO_SOON: { code: 108303, message: '定时时间必须在 30 秒后' },
  NOTIFY_TASK_CRON_INVALID: { code: 108304, message: 'Cron 表达式非法' },
  // 消息相关 108401-108499
  NOTIFY_MESSAGE_NOT_FOUND: { code: 108401, message: '消息不存在或无权访问' },
  // 业务跳过 108501-108599（HTTP 200，仅业务标记）
  NOTIFY_SKIP_UNSUBSCRIBED: { code: 108501, message: '用户已取消订阅，跳过发送' },
  NOTIFY_SKIP_RATE_LIMITED: { code: 108502, message: '命中频控限制，跳过发送' },
  NOTIFY_SKIP_QUIET_HOUR: { code: 108503, message: '命中静默时段，跳过发送' },
  NOTIFY_SEND_DIRECT_NOT_ALLOWED: { code: 108504, message: 'sendDirect 仅允许验证码模板' },
  NOTIFY_BYPASS_PREFERENCE_NOT_ALLOWED: { code: 108505, message: 'bypassPreference 仅允许 P0 + 强制类型' },
  // 渠道相关 108600-108699
  NOTIFY_CHANNEL_INVALID: { code: 108600, message: '不支持的渠道' },
  NOTIFY_CHANNEL_CONFIG_INVALID: { code: 108601, message: '渠道服务商配置不存在或不可用' },
  NOTIFY_EMAIL_SEND_FAILED: { code: 108602, message: '邮件发送失败' },
  NOTIFY_SMS_SEND_FAILED: { code: 108603, message: '短信发送失败' },
  // 幂等 108701-108799
  NOTIFY_IDEMPOTENT_HIT: { code: 108701, message: '幂等键命中（24h 内重复）' },
  // 偏好 108801-108899
  NOTIFY_PREFERENCE_LOCKED: { code: 108801, message: '此类型不可关闭订阅' },
  // 队列/服务 108901-108999
  NOTIFY_QUEUE_UNAVAILABLE: { code: 108901, message: '队列连接异常' },
  NOTIFY_CHANNEL_DOWN: { code: 108902, message: '渠道整体降级中' },
};

/**
 * 通知模块错误码别名（业务代码内 ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND) 使用）
 * 仅作转发，与 ErrorCodes.NOTIFY_* 完全等价。
 */
export const NOTIF_ERR = {
  TEMPLATE_NOT_FOUND: ErrorCodes.NOTIFY_TEMPLATE_NOT_FOUND,
  TEMPLATE_NOT_PUBLISHED: ErrorCodes.NOTIFY_TEMPLATE_NOT_PUBLISHED,
  TEMPLATE_HAS_TASKS: ErrorCodes.NOTIFY_TEMPLATE_HAS_TASKS,
  TEMPLATE_VAR_MISSING: ErrorCodes.NOTIFY_TEMPLATE_VAR_MISSING,
  TEMPLATE_SYNTAX: ErrorCodes.NOTIFY_TEMPLATE_SYNTAX,
  TEMPLATE_ACTIVE_LOCKED: ErrorCodes.NOTIFY_TEMPLATE_ACTIVE_LOCKED,
  TYPE_NOT_FOUND: ErrorCodes.NOTIFY_TYPE_NOT_FOUND,
  TYPE_SYSTEM_LOCKED: ErrorCodes.NOTIFY_TYPE_SYSTEM_LOCKED,
  TYPE_DISABLED: ErrorCodes.NOTIFY_TYPE_DISABLED,
  TYPE_KEY_DUPLICATED: ErrorCodes.NOTIFY_TYPE_KEY_DUPLICATED,
  TYPE_IN_USE: ErrorCodes.NOTIFY_TYPE_IN_USE,
  AUDIENCE_DYNAMIC_NOT_IMPL: ErrorCodes.NOTIFY_AUDIENCE_DYNAMIC_NOT_IMPL,
  AUDIENCE_TYPE_INVALID: ErrorCodes.NOTIFY_AUDIENCE_TYPE_INVALID,
  AUDIENCE_NOT_FOUND: ErrorCodes.NOTIFY_AUDIENCE_NOT_FOUND,
  TASK_NOT_FOUND: ErrorCodes.NOTIFY_TASK_NOT_FOUND,
  TASK_STATUS_INVALID: ErrorCodes.NOTIFY_TASK_STATUS_INVALID,
  MESSAGE_NOT_FOUND: ErrorCodes.NOTIFY_MESSAGE_NOT_FOUND,
  CHANNEL_INVALID: ErrorCodes.NOTIFY_CHANNEL_INVALID,
  CHANNEL_CONFIG_INVALID: ErrorCodes.NOTIFY_CHANNEL_CONFIG_INVALID,
  EMAIL_SEND_FAILED: ErrorCodes.NOTIFY_EMAIL_SEND_FAILED,
  SMS_SEND_FAILED: ErrorCodes.NOTIFY_SMS_SEND_FAILED,
  IDEMPOTENT_HIT: ErrorCodes.NOTIFY_IDEMPOTENT_HIT,
  PREFERENCE_LOCKED: ErrorCodes.NOTIFY_PREFERENCE_LOCKED,
  QUEUE_UNAVAILABLE: ErrorCodes.NOTIFY_QUEUE_UNAVAILABLE,
  CHANNEL_DOWN: ErrorCodes.NOTIFY_CHANNEL_DOWN,
} as const;
