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
};
