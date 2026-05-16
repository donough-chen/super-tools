import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import BaseService, { PaginationOptions, PaginationResult } from './base';

export default class AuthService extends BaseService {

  // ===== 安全阈值常量 =====
  private readonly FAIL_CAPTCHA_THRESHOLD = 5;       // 5次失败 → 需要验证码
  private readonly FAIL_TEMP_LOCK_THRESHOLD = 8;     // 8次失败 → 锁定15分钟
  private readonly FAIL_LONG_LOCK_THRESHOLD = 10;    // 10次失败 → 锁定60分钟
  private readonly FAIL_PERMANENT_THRESHOLD = 15;    // 15次失败 → 永久锁定
  private readonly FAIL_COUNT_TTL = 3600;            // 失败计数 TTL 1小时

  /**
   * 密码登录（SSO 完整流程 + 增强安全机制）
   */
  async login(dto: { username: string; password: string; clientId: string; clientSecret: string; platform?: string; captcha?: string }) {
    const { username, password, clientId, clientSecret, platform, captcha } = dto;
    const { Op } = require('sequelize');

    // 0. 安全检查: 账号锁定 + 验证码
    await this.checkLoginSecurity(username, captcha);

    // 1. 验证 OAuth 客户端
    const { clientData } = await this.validateClient(clientId, clientSecret);

    // 2. 查找用户
    const user = await this.ctx.model.User.findOne({
      where: { [Op.or]: [{ username }, { email: username }, { phone: username }], status: 1 },
    });
    if (!user) {
      await this.writeLoginLog({ username, clientId, platform: platform || clientData.platform, status: 0, failReason: '用户不存在或已禁用' });
      this.ctx.throw(401, '用户名或密码错误');
    }
    const userData = (user as any).toJSON();

    // 3. 验证密码
    if (!userData.passwordHash) {
      this.ctx.throw(401, '该账号未设置密码，请使用第三方登录');
    }
    const isValid = await bcrypt.compare(password, userData.passwordHash);
    if (!isValid) {
      await this.writeLoginLog({ userId: userData.id, username, clientId, platform: platform || clientData.platform, status: 0, failReason: '密码错误' });
      await this.recordLoginFailure(username);
      this.ctx.throw(401, '用户名或密码错误');
    }

    // 4. 生成 Token + 创建 Session
    const loginPlatform = platform || clientData.platform;
    const tokens = await this.createSession(userData, clientData, loginPlatform);

    // 5. 更新用户登录信息 + 清除失败计数
    await (user as any).update({
      lastLoginAt: new Date(),
      lastLoginIp: this.ctx.ip,
      lastLoginPlatform: loginPlatform,
      loginCount: (userData.loginCount || 0) + 1,
    });
    await this.clearLoginFailure(username);

    // 6. 写登录日志
    await this.writeLoginLog({ userId: userData.id, username, clientId, platform: loginPlatform, loginType: 'password', status: 1 });

    return tokens;
  }

  /**
   * 微信登录（登录即注册，策略模式）
   * 统一入口: /api/auth/wechat-login
   */
  async wechatLogin(dto: {
    code: string;
    platform: string;     // miniprogram | h5 | app | ios | android
    clientId: string;
    clientSecret: string;
    userInfo?: any;       // 小程序端可传用户信息
  }) {
    const { code, platform, clientId, clientSecret, userInfo } = dto;
    const { Op } = require('sequelize');

    // 1. 验证 OAuth 客户端
    const { clientData } = await this.validateClient(clientId, clientSecret);

    // 2. 调用微信服务获取 openId/unionId
    const wechatResult = await this.service.wechat.login(platform, code, userInfo);

    // 3. 查找已有绑定关系（优先 unionId，其次 openId）
    const oauthWhere: any = { platform: `wechat_${platform}` };
    if (wechatResult.unionId) {
      oauthWhere[Op.or] = [
        { unionId: wechatResult.unionId },
        { openId: wechatResult.openId },
      ];
    } else {
      oauthWhere.openId = wechatResult.openId;
    }

    let oauthRecord = await this.ctx.model.UserOauth.findOne({ where: oauthWhere });
    let user: any;

    if (oauthRecord) {
      // 4a. 已绑定 → 查找用户直接登录
      const oauthData = (oauthRecord as any).toJSON();
      user = await this.ctx.model.User.findByPk(oauthData.userId);
      if (!user || (user as any).status !== 1) {
        this.ctx.throw(401, '用户不存在或已被禁用');
      }

      // 更新 OAuth 信息
      await (oauthRecord as any).update({
        accessToken: wechatResult.accessToken,
        refreshToken: wechatResult.refreshToken,
        nickname: wechatResult.nickname || oauthData.nickname,
        avatar: wechatResult.avatar || oauthData.avatar,
        rawData: wechatResult.rawData,
      });
    } else {
      // 4b. 未绑定 → 自动创建用户 + 绑定（登录即注册）
      user = await this.ctx.model.User.create({
        uuid: uuidv4(),
        nickname: wechatResult.nickname || `微信用户_${wechatResult.openId.slice(-6)}`,
        avatar: wechatResult.avatar,
        registerSource: `wechat_${platform}`,
        registerIp: this.ctx.ip,
      } as any);

      // 创建 OAuth 绑定
      await this.ctx.model.UserOauth.create({
        userId: (user as any).id,
        platform: `wechat_${platform}`,
        openId: wechatResult.openId,
        unionId: wechatResult.unionId,
        accessToken: wechatResult.accessToken,
        refreshToken: wechatResult.refreshToken,
        nickname: wechatResult.nickname,
        avatar: wechatResult.avatar,
        rawData: wechatResult.rawData,
      } as any);

      // 分配默认角色
      const defaultRole = await this.ctx.model.Role.findOne({ where: { code: 'user' } });
      if (defaultRole) {
        await this.ctx.model.UserRole.create({ userId: (user as any).id, roleId: (defaultRole as any).id } as any);
      }

      // 自动创建 profile
      await this.ctx.model.UserProfile.create({
        userId: (user as any).id,
        referralCode: this.generateReferralCode(),
      } as any);

      // 初始化会员记录
      try { await this.service.member.initMember((user as any).id); } catch (e) { this.ctx.logger.warn('[wechatLogin] initMember failed', e); }
    }

    const userData = (user as any).toJSON();
    const loginPlatform = platform || clientData.platform;

    // 5. 创建 Session + Token
    const tokens = await this.createSession(userData, clientData, loginPlatform);

    // 6. 更新登录信息
    await (user as any).update({
      lastLoginAt: new Date(),
      lastLoginIp: this.ctx.ip,
      lastLoginPlatform: loginPlatform,
      loginCount: (userData.loginCount || 0) + 1,
    });

    // 7. 写登录日志
    await this.writeLoginLog({
      userId: userData.id, username: userData.username || userData.nickname,
      clientId, platform: loginPlatform, loginType: `wechat_${platform}`, status: 1,
    });

    return { ...tokens, isNewUser: !oauthRecord };
  }

  /**
   * 手机号验证码登录（登录即注册）
   *
   * 唯一性保障：手机号全局唯一，一号一账号。
   * - 号码已存在且状态正常 → 直接登录
   * - 号码已存在但状态非 1（禁用/待审/注销） → 抛 403
   * - 号码不存在 → 自动注册并登录
   *
   * 验证码类型兼容：phone-login 同时承担登录/注册入口，前端可能用
   * type=login 或 type=register 发码，两者都允许通过。
   */
  async phoneLogin(dto: {
    phone: string;
    code: string;
    clientId: string;
    clientSecret: string;
    platform?: string;
  }) {
    const { code, clientId, clientSecret, platform } = dto;
    const phone = (dto.phone || '').trim();

    // 1. 验证 OAuth 客户端
    const { clientData } = await this.validateClient(clientId, clientSecret);

    // 2. 验证短信验证码（兼容 login / register 两种 type）
    const isValid = await this.service.sms.verifyCode(phone, code, ['login', 'register']);
    if (!isValid) {
      this.ctx.throw(401, '验证码错误或已过期');
    }

    // 3. 查找该手机号对应的用户（不带 status 过滤，以便对禁用账号做区分提示）
    let user = await this.ctx.model.User.findOne({ where: { phone } });
    let isNewUser = false;

    if (user) {
      // 3a. 号码已存在 → 状态校验
      const status = (user as any).status;
      if (status !== 1) {
        // 0 禁用 / 2 待审核 / 3 已注销
        const reasonMap: Record<number, string> = {
          0: '该账号已被禁用，请联系管理员',
          2: '该账号待审核中，暂不能登录',
          3: '该账号已注销，无法登录',
        };
        this.ctx.throw(403, reasonMap[status] || '账号状态异常，无法登录');
      }
    } else {
      // 3b. 号码不存在 → 自动注册（unique 冲突兜底）
      try {
        user = await this.ctx.model.User.create({
          uuid: uuidv4(),
          phone,
          nickname: `用户_${phone.slice(-4)}`,
          registerSource: platform || 'h5',
          registerIp: this.ctx.ip,
        } as any);
      } catch (err: any) {
        if (err?.name === 'SequelizeUniqueConstraintError') {
          // 并发场景：两次请求同时走到 create，其中一次胜出。
          // 重新按 phone 查出用户继续后续登录流程。
          user = await this.ctx.model.User.findOne({ where: { phone } });
          if (!user) this.ctx.throw(500, '账号创建异常，请重试');
        } else {
          throw err;
        }
      }

      isNewUser = true;

      // 分配默认角色（并发下可能已存在，冲突忽略）
      const defaultRole = await this.ctx.model.Role.findOne({ where: { code: 'user' } });
      if (defaultRole) {
        try {
          await this.ctx.model.UserRole.create({ userId: (user as any).id, roleId: (defaultRole as any).id } as any);
        } catch { /* 并发冲突忽略 */ }
      }

      // 自动创建 profile（唯一索引冲突忽略）
      try {
        await this.ctx.model.UserProfile.create({
          userId: (user as any).id,
          referralCode: this.generateReferralCode(),
        } as any);
      } catch { /* 并发冲突忽略 */ }

      // 初始化会员记录
      try { await this.service.member.initMember((user as any).id); } catch (e) { this.ctx.logger.warn('[phoneLogin] initMember failed', e); }
    }

    const userData = (user as any).toJSON();
    const loginPlatform = platform || clientData.platform;

    // 4. 创建 Session + Token
    const tokens = await this.createSession(userData, clientData, loginPlatform);

    // 5. 更新登录信息
    await (user as any).update({
      lastLoginAt: new Date(),
      lastLoginIp: this.ctx.ip,
      lastLoginPlatform: loginPlatform,
      loginCount: (userData.loginCount || 0) + 1,
    });

    // 6. 写登录日志
    await this.writeLoginLog({
      userId: userData.id, username: phone, clientId,
      platform: loginPlatform, loginType: 'phone', status: 1,
    });

    return { ...tokens, isNewUser };
  }

  /**
   * 注册（邮箱 + 用户名 + 密码）
   *
   * 唯一性保障：
   * - 用户名（username）全局唯一
   * - 邮箱（email）全局唯一
   * - 可选手机号（phone）若传入则也校验唯一
   *
   * 命中已有账号时精确返回冲突字段，而不是含糊的"已被注册"。
   */
  async register(dto: { username: string; email: string; password: string; nickname?: string; clientId: string; platform?: string; phone?: string }) {
    const { password, nickname, platform } = dto;
    const username = (dto.username || '').trim();
    const email = (dto.email || '').trim().toLowerCase();
    const phone = (dto.phone || '').trim();
    const { Op } = require('sequelize');

    // 1. 唯一性校验：为每个字段分别查询，明确指出冲突项
    if (username) {
      const hit = await this.ctx.model.User.findOne({ where: { username } });
      if (hit) this.ctx.throw(400, '用户名已被注册');
    }
    if (email) {
      const hit = await this.ctx.model.User.findOne({ where: { email } });
      if (hit) this.ctx.throw(400, '邮箱已被注册');
    }
    if (phone) {
      const hit = await this.ctx.model.User.findOne({ where: { phone } });
      if (hit) this.ctx.throw(400, '手机号已被注册');
    }

    // 2. 创建用户
    const passwordHash = await bcrypt.hash(password, 12);
    let user: any;
    try {
      user = await this.ctx.model.User.create({
        uuid: uuidv4(),
        username,
        email,
        phone: phone || null,
        passwordHash,
        nickname: nickname || username,
        registerSource: platform || 'web',
        registerIp: this.ctx.ip,
      } as any);
    } catch (err: any) {
      // 并发双写兜底：唯一索引冲突
      if (err?.name === 'SequelizeUniqueConstraintError') {
        const field = Object.keys(err?.fields || {})[0] || '';
        const fieldMap: Record<string, string> = { username: '用户名', email: '邮箱', phone: '手机号' };
        const label = fieldMap[field] || '该账号信息';
        this.ctx.throw(400, `${label}已被注册`);
      }
      throw err;
    }

    // 3. 分配默认角色(user)
    const defaultRole = await this.ctx.model.Role.findOne({ where: { code: 'user' } });
    if (defaultRole) {
      await this.ctx.model.UserRole.create({ userId: (user as any).id, roleId: (defaultRole as any).id } as any);
    }

    // 4. 自动创建 profile
    await this.ctx.model.UserProfile.create({
      userId: (user as any).id,
      referralCode: this.generateReferralCode(),
    } as any);

    // 5. 初始化会员记录
    try { await this.service.member.initMember((user as any).id); } catch (e) { this.ctx.logger.warn('[register] initMember failed', e); }

    return { id: (user as any).id, uuid: (user as any).uuid };
  }

  /**
   * 绑定手机号
   */
  async bindPhone(userId: number, phone: string, code: string) {
    // 1. 验证短信验证码
    const isValid = await this.service.sms.verifyCode(phone, code, 'bind');
    if (!isValid) {
      this.ctx.throw(400, '验证码错误或已过期');
    }

    // 2. 检查手机号是否已被其他用户使用
    const existingUser = await this.ctx.model.User.findOne({ where: { phone } });
    if (existingUser && (existingUser as any).id !== userId) {
      this.ctx.throw(400, '该手机号已被其他用户绑定');
    }

    // 3. 更新用户手机号
    const user = await this.ctx.model.User.findByPk(userId);
    if (!user) this.ctx.throw(404, '用户不存在');
    await (user as any).update({ phone });

    // 清除用户缓存
    await this.clearCache(`user:${userId}`);
    return { message: '手机号绑定成功' };
  }

  /**
   * 绑定微信
   */
  async bindWechat(userId: number, platform: string, code: string) {
    // 1. 通过微信服务获取 openId
    const wechatResult = await this.service.wechat.login(platform, code);

    // 2. 检查是否已被其他用户绑定
    const existing = await this.ctx.model.UserOauth.findOne({
      where: { openId: wechatResult.openId, platform: `wechat_${platform}` },
    });
    if (existing && (existing as any).userId !== userId) {
      this.ctx.throw(400, '该微信账号已被其他用户绑定');
    }
    if (existing && (existing as any).userId === userId) {
      this.ctx.throw(400, '您已绑定该微信账号');
    }

    // 3. 创建绑定记录
    await this.ctx.model.UserOauth.create({
      userId,
      platform: `wechat_${platform}`,
      openId: wechatResult.openId,
      unionId: wechatResult.unionId,
      accessToken: wechatResult.accessToken,
      refreshToken: wechatResult.refreshToken,
      nickname: wechatResult.nickname,
      avatar: wechatResult.avatar,
      rawData: wechatResult.rawData,
    } as any);

    return { message: '微信绑定成功' };
  }

  /**
   * 绑定邮箱
   */
  async bindEmail(userId: number, email: string, code: string) {
    // 1. 验证邮箱验证码
    const isValid = await this.service.sms.verifyCode(email, code, 'bind');
    if (!isValid) {
      this.ctx.throw(400, '验证码错误或已过期');
    }

    // 2. 检查邮箱是否已被其他用户使用
    const existingUser = await this.ctx.model.User.findOne({ where: { email } });
    if (existingUser && (existingUser as any).id !== userId) {
      this.ctx.throw(400, '该邮箱已被其他用户绑定');
    }

    // 3. 更新
    const user = await this.ctx.model.User.findByPk(userId);
    if (!user) this.ctx.throw(404, '用户不存在');
    await (user as any).update({ email });

    await this.clearCache(`user:${userId}`);
    return { message: '邮箱绑定成功' };
  }

  /**
   * 解绑账号（手机/微信/邮箱）
   * 安全规则: 至少保留一种登录方式
   */
  async unbind(userId: number, type: string, platform?: string) {
    const user = await this.ctx.model.User.findByPk(userId);
    if (!user) this.ctx.throw(404, '用户不存在');
    const userData = (user as any).toJSON();

    // 计算当前绑定的登录方式数量
    const loginMethods: string[] = [];
    if (userData.passwordHash) loginMethods.push('password');
    if (userData.phone) loginMethods.push('phone');
    if (userData.email) loginMethods.push('email');

    const oauthCount = await this.ctx.model.UserOauth.count({ where: { userId } });
    const totalMethods = loginMethods.length + oauthCount;

    if (totalMethods <= 1) {
      this.ctx.throw(400, '不能解绑最后一种登录方式');
    }

    switch (type) {
      case 'phone':
        await (user as any).update({ phone: null });
        break;
      case 'email':
        await (user as any).update({ email: null });
        break;
      case 'wechat':
        const oauthWhere: any = { userId };
        if (platform) {
          oauthWhere.platform = `wechat_${platform}`;
        } else {
          oauthWhere.platform = { [require('sequelize').Op.like]: 'wechat_%' };
        }
        const deleted = await this.ctx.model.UserOauth.destroy({ where: oauthWhere });
        if (!deleted) this.ctx.throw(404, '未找到该绑定关系');
        break;
      default:
        this.ctx.throw(400, '不支持的解绑类型');
    }

    await this.clearCache(`user:${userId}`);
    return { message: '解绑成功' };
  }

  /**
   * 获取账号绑定状态
   */
  async getBindStatus(userId: number) {
    const user = await this.ctx.model.User.findByPk(userId, {
      attributes: ['phone', 'email', 'passwordHash'],
    });
    if (!user) this.ctx.throw(404, '用户不存在');
    const userData = (user as any).toJSON();

    const oauthBindings = await this.ctx.model.UserOauth.findAll({
      where: { userId },
      attributes: ['platform', 'nickname', 'avatar', 'created_at'],
    });

    return {
      hasPassword: !!userData.passwordHash,
      phone: userData.phone ? userData.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      email: userData.email ? userData.email.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
      wechat: oauthBindings.filter((b: any) => b.platform?.startsWith('wechat_')).map((b: any) => {
        const data = b.toJSON();
        return { platform: data.platform, nickname: data.nickname, avatar: data.avatar, boundAt: data.created_at };
      }),
    };
  }

  /**
   * 刷新 Token
   */
  async refreshToken(refreshToken: string) {
    const session = await this.ctx.model.UserSession.findOne({
      where: { refreshToken, isActive: 1 },
    });
    if (!session) {
      this.ctx.throw(401, '无效的 RefreshToken');
    }
    const sessionData = (session as any).toJSON();

    if (new Date(sessionData.refreshExpireAt) < new Date()) {
      await (session as any).update({ isActive: 0, logoutType: 2 });
      this.ctx.throw(401, 'RefreshToken 已过期，请重新登录');
    }

    const user = await this.ctx.model.User.findByPk(sessionData.userId);
    if (!user || (user as any).status !== 1) {
      this.ctx.throw(401, '用户不存在或已被禁用');
    }

    const client = await this.ctx.model.OauthClient.findOne({ where: { clientId: sessionData.clientId } });
    const clientData = client ? (client as any).toJSON() : { accessTokenTtl: 7200, refreshTokenTtl: 2592000 };

    // 使旧 session 失效
    await (session as any).update({ isActive: 0, logoutType: 2 });

    // 创建新 session
    return this.createSession((user as any).toJSON(), clientData, sessionData.platform);
  }

  /**
   * 登出
   */
  async logout(sessionId: string) {
    const session = await this.ctx.model.UserSession.findOne({ where: { sessionId, isActive: 1 } });
    if (session) {
      await (session as any).update({ isActive: 0, logoutAt: new Date(), logoutType: 1 });
    }
  }

  /**
   * 获取用户会话列表
   */
  async getSessions(userId: number) {
    try {
      const sessions = await this.ctx.model.UserSession.findAll({
        where: { userId, isActive: 1 },
        attributes: ['sessionId', 'platform', 'ip', 'deviceName', 'location', 'created_at'],
        order: [['created_at', 'DESC']],
      });
      return sessions.map((s: any) => {
        const json = s.toJSON();
        return {
          ...json,
          createdAt: json.created_at,
        };
      });
    } catch (err: any) {
      console.error('[getSessions] error:', err.message, err.stack?.split('\n')[0]);
      this.ctx.logger.error('[getSessions] error:', err.message);
      throw err;
    }
  }

  /**
   * 踢掉某个会话
   */
  async kickSession(sessionId: string, userId: number) {
    const session = await this.ctx.model.UserSession.findOne({ where: { sessionId, userId, isActive: 1 } });
    if (!session) this.ctx.throw(404, '会话不存在');
    await (session as any).update({ isActive: 0, logoutAt: new Date(), logoutType: 3 });
  }

  /**
   * 发送验证码（升级版 — 委托给 SmsService）
   */
  async sendVerifyCode(dto: { target: string; type: string; platform?: string }) {
    const { target, type, platform } = dto;
    const result = await this.service.sms.sendCode({ phone: target, type, platform });

    // 触发通知：验证码发送审计（仅站内信，避免循环发短信）
    // 需要有 userId 才能发通知；验证码发送时可能是未登录状态，此时跳过
    try {
      const user = (this.ctx as any).state?.user || (this.ctx as any).user;
      if (user?.id) {
        const typeCodeMap: Record<string, string> = {
          login: 'VERIFY_CODE_LOGIN',
          register: 'VERIFY_CODE_REGISTER',
          reset: 'VERIFY_CODE_RESET',
          bind: 'VERIFY_CODE_BIND',
        };
        const typeCode = typeCodeMap[type] || 'VERIFY_CODE_LOGIN';
        await this.ctx.service.notification.sendDirect({
          typeCode,
          userId: user.id,
          variables: {
            target: target.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
            scene: type,
          },
          channels: ['in_app'],
        });
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[auth.sendVerifyCode] notification failed: ${e.message}`);
    }

    return result;
  }

  // ===== 私有方法 =====

  /**
   * 验证 OAuth 客户端
   */
  private async validateClient(clientId: string, clientSecret: string) {
    const client = await this.ctx.model.OauthClient.findOne({ where: { clientId, status: 1 } });
    if (!client) {
      this.ctx.throw(401, '无效的客户端');
    }
    const clientData = (client as any).toJSON();
    if (clientData.clientSecret !== clientSecret) {
      this.ctx.throw(401, '客户端密钥错误');
    }
    return { clientData };
  }

  /**
   * 登录安全检查: 渐进式锁定策略
   * 5次 → 需要验证码 | 8次 → 锁定15分钟 | 10次 → 锁定60分钟 | 15次 → 永久锁定
   */
  private async checkLoginSecurity(username: string, captcha?: string) {
    try {
      const failKey = `login:fail:${username}`;
      const failCount = Number(await this.app.redis.get(failKey)) || 0;

      if (failCount >= this.FAIL_PERMANENT_THRESHOLD) {
        this.ctx.throw(423, '账号已被永久锁定，请联系管理员');
      }

      if (failCount >= this.FAIL_LONG_LOCK_THRESHOLD) {
        const lockKey = `login:lock:${username}`;
        const isLocked = await this.app.redis.get(lockKey);
        if (isLocked) {
          this.ctx.throw(423, '账号已被临时锁定，请60分钟后重试');
        }
      }

      if (failCount >= this.FAIL_TEMP_LOCK_THRESHOLD) {
        const lockKey = `login:lock:${username}`;
        const isLocked = await this.app.redis.get(lockKey);
        if (isLocked) {
          this.ctx.throw(423, '账号已被临时锁定，请15分钟后重试');
        }
      }

      if (failCount >= this.FAIL_CAPTCHA_THRESHOLD) {
        if (!captcha) {
          this.ctx.throw(428, '登录失败次数过多，请输入验证码');
        }
        // TODO: 验证图形验证码
      }
    } catch (err: any) {
      if (err.status === 423 || err.status === 428) throw err;
      // Redis 不可用时跳过安全检查
    }
  }

  private async createSession(user: any, client: any, platform: string) {
    const jwtConfig = (this.app.config as any).jwt;
    const accessTtl = client.accessTokenTtl || 7200;
    const refreshTtl = client.refreshTokenTtl || 2592000;

    const payload = { id: user.id, uuid: user.uuid, username: user.username, nonce: Math.random().toString(36).slice(2) };
    const accessToken = this.app.jwt.sign({ ...payload, type: 'access' }, jwtConfig.secret, { expiresIn: accessTtl });
    const refreshToken = this.app.jwt.sign({ ...payload, type: 'refresh' }, jwtConfig.secret, { expiresIn: refreshTtl });

    const sessionId = uuidv4().replace(/-/g, '') + Date.now().toString(36);
    const now = new Date();

    await this.ctx.model.UserSession.create({
      sessionId,
      userId: user.id,
      clientId: client.clientId,
      platform,
      accessToken,
      refreshToken,
      accessExpireAt: new Date(now.getTime() + accessTtl * 1000),
      refreshExpireAt: new Date(now.getTime() + refreshTtl * 1000),
      ip: this.ctx.ip,
      userAgent: this.ctx.get('user-agent'),
    } as any);

    // 触发通知：异常登录检测（非阻塞）
    this._checkAndNotifyUnusualLogin(user).catch((e: any) => {
      this.ctx.logger.warn(`[auth] unusual login notification failed: ${e.message}`);
    });

    return { accessToken, refreshToken, expiresIn: accessTtl, sessionId };
  }

  /**
   * 检测异常登录并发送通知
   * 简单逻辑：当前 IP 与上次登录 IP 不同时视为异地登录
   */
  private async _checkAndNotifyUnusualLogin(user: any) {
    if (!user.lastLoginIp || user.lastLoginIp === this.ctx.ip) return;
    try {
      await this.ctx.service.notification.sendDirect({
        typeCode: 'SYSTEM_UNUSUAL_LOGIN',
        userId: user.id,
        variables: {
          ip: this.ctx.ip,
          lastIp: user.lastLoginIp,
          device: this.ctx.get('user-agent')?.substring(0, 100) || '未知',
          time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[auth] unusual login notify error: ${e.message}`);
    }
  }

  private async writeLoginLog(data: any) {
    try {
      await this.ctx.model.LoginLog.create({
        userId: data.userId,
        username: data.username,
        clientId: data.clientId,
        platform: data.platform || 'web',
        loginType: data.loginType || 'password',
        ip: this.ctx.ip,
        userAgent: this.ctx.get('user-agent'),
        status: data.status,
        failReason: data.failReason,
      } as any);
    } catch (err) {
      this.ctx.logger.error('[LoginLog] write failed', err);
    }
  }

  /**
   * 记录登录失败 + 渐进式锁定
   */
  private async recordLoginFailure(username: string) {
    try {
      const key = `login:fail:${username}`;
      const count = await this.app.redis.incr(key);
      if (count === 1) await this.app.redis.expire(key, this.FAIL_COUNT_TTL);

      // 渐进式锁定
      if (count >= this.FAIL_LONG_LOCK_THRESHOLD) {
        await this.app.redis.setex(`login:lock:${username}`, 3600, '1'); // 锁定60分钟
        this.ctx.logger.warn(`[Security] 账号 ${username} 登录失败 ${count} 次，锁定60分钟`);
      } else if (count >= this.FAIL_TEMP_LOCK_THRESHOLD) {
        await this.app.redis.setex(`login:lock:${username}`, 900, '1');  // 锁定15分钟
        this.ctx.logger.warn(`[Security] 账号 ${username} 登录失败 ${count} 次，锁定15分钟`);
      } else if (count >= this.FAIL_CAPTCHA_THRESHOLD) {
        this.ctx.logger.warn(`[Security] 账号 ${username} 登录失败 ${count} 次，需要验证码`);
      }
    } catch { /* redis 不可用时跳过 */ }
  }

  /**
   * 登录成功后清除失败计数
   */
  private async clearLoginFailure(username: string) {
    try {
      await this.app.redis.del(`login:fail:${username}`);
      await this.app.redis.del(`login:lock:${username}`);
    } catch { /* ignore */ }
  }

  /**
   * 生成邀请码
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
