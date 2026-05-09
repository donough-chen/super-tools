import BaseService from './base';

/**
 * 短信验证码服务
 * 安全机制:
 *   - 60秒发送间隔
 *   - 单号码每日限额 10 条
 *   - 单 IP 每小时限额 20 条
 *   - Redis 分布式锁原子消费验证码
 *   - 5次验证失败锁定 30 分钟
 */
export default class SmsService extends BaseService {

  private readonly VERIFY_CODE_TTL = 5 * 60; // 验证码有效期 5 分钟
  private readonly SEND_INTERVAL = 60;        // 发送间隔 60 秒
  private readonly DAILY_LIMIT = 10;          // 每日每号码限额
  private readonly IP_HOURLY_LIMIT = 20;      // 每IP每小时限额
  private readonly VERIFY_FAIL_LIMIT = 5;     // 验证失败限额
  private readonly VERIFY_LOCK_TTL = 30 * 60; // 验证失败锁定 30 分钟

  /**
   * 发送验证码
   */
  async sendCode(dto: {
    phone: string;
    type: string;       // login | register | reset | bind
    platform?: string;
  }): Promise<{ message: string }> {
    const { phone, type, platform = 'web' } = dto;
    const ip = this.ctx.ip;

    // 1. 频率限制检查
    await this.checkSendFrequency(phone, ip);

    // 2. 生成 6 位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expireAt = new Date(Date.now() + this.VERIFY_CODE_TTL * 1000);

    // 3. 写入数据库
    await this.ctx.model.VerifyCode.create({
      target: phone,
      type,
      platform,
      code,
      ip,
      expireAt,
    } as any);

    // 4. 设置 Redis 缓存（用于快速校验）
    try {
      const cacheKey = `verify:code:${phone}:${type}`;
      await this.app.redis.setex(cacheKey, this.VERIFY_CODE_TTL, code);

      // 设置发送间隔标记
      const intervalKey = `verify:interval:${phone}`;
      await this.app.redis.setex(intervalKey, this.SEND_INTERVAL, '1');

      // 增加计数器
      await this.service.cache.increment(`verify:daily:${phone}`, 86400);
      await this.service.cache.increment(`verify:ip:${ip}`, 3600);
    } catch {
      // Redis 不可用不影响主流程
    }

    // 5. 调用短信发送（当前为模拟）
    await this.doSend(phone, code, type);

    this.ctx.logger.info(`[SmsService] 验证码已发送: ${phone} => ${code} (type: ${type})`);
    return { message: '验证码已发送' };
  }

  /**
   * 验证验证码 — Redis 分布式锁保证原子消费
   *
   * @param phone 手机号/邮箱
   * @param code  用户填写的验证码
   * @param type  验证码类型，支持单个字符串或字符串数组；数组时任一命中即算通过
   *              （用于 phone-login 这类"登录即注册"场景，login / register 任一有效即可）
   */
  async verifyCode(phone: string, code: string, type: string | string[]): Promise<boolean> {
    // 1. 检查验证失败锁定
    const lockKey = `verify:lock:${phone}`;
    try {
      const lockCount = await this.app.redis.get(lockKey);
      if (lockCount && Number(lockCount) >= this.VERIFY_FAIL_LIMIT) {
        this.ctx.throw(429, '验证失败次数过多，请30分钟后重试');
      }
    } catch (err: any) {
      if (err.status === 429) throw err;
      // Redis 不可用继续走数据库
    }

    const types = Array.isArray(type) ? type : [type];

    // 2. 尝试从 Redis 快速校验（按传入顺序依次探测）
    try {
      let redisSeenAny = false;
      for (const t of types) {
        const cacheKey = `verify:code:${phone}:${t}`;
        const cachedCode = await this.app.redis.get(cacheKey);
        if (!cachedCode) continue;
        redisSeenAny = true;

        if (cachedCode !== code) {
          // 当前 type 的码存在但不匹配 → 继续尝试其他 type
          continue;
        }

        // 命中：原子消费
        const lockValue = await this.service.cache.acquireLock(`verify:consume:${phone}`, 10);
        if (lockValue) {
          try {
            await this.app.redis.del(cacheKey);
            await this.markCodeUsed(phone, code, t);
            return true;
          } finally {
            await this.service.cache.releaseLock(`verify:consume:${phone}`, lockValue);
          }
        }
      }

      // Redis 中存在候选类型的码但都不匹配 → 记失败并直接返回
      if (redisSeenAny) {
        await this.recordVerifyFailure(phone);
        return false;
      }
    } catch (err: any) {
      if (err.status === 429) throw err;
      // Redis 不可用，降级到数据库
    }

    // 3. 降级: 从数据库校验（type 用 IN 查询）
    return this.verifyFromDB(phone, code, types);
  }

  // ===== 私有方法 =====

  /**
   * 检查发送频率
   */
  private async checkSendFrequency(phone: string, ip: string): Promise<void> {
    try {
      // 60 秒间隔检查
      const intervalKey = `verify:interval:${phone}`;
      const hasInterval = await this.app.redis.get(intervalKey);
      if (hasInterval) {
        this.ctx.throw(429, '验证码发送过于频繁，请60秒后重试');
      }

      // 每日限额检查
      const dailyKey = `verify:daily:${phone}`;
      const dailyCount = await this.app.redis.get(dailyKey);
      if (dailyCount && Number(dailyCount) >= this.DAILY_LIMIT) {
        this.ctx.throw(429, '今日验证码发送次数已达上限');
      }

      // IP 每小时限额检查
      const ipKey = `verify:ip:${ip}`;
      const ipCount = await this.app.redis.get(ipKey);
      if (ipCount && Number(ipCount) >= this.IP_HOURLY_LIMIT) {
        this.ctx.throw(429, '当前IP发送验证码过于频繁');
      }
    } catch (err: any) {
      if (err.status === 429) throw err;
      // Redis 不可用时跳过限流（降级策略）
      this.ctx.logger.warn('[SmsService] Redis unavailable, skipping rate limit');
    }
  }

  /**
   * 数据库降级验证
   */
  private async verifyFromDB(phone: string, code: string, types: string[]): Promise<boolean> {
    const { Op } = require('sequelize');

    const record = await this.ctx.model.VerifyCode.findOne({
      where: {
        target: phone,
        type: { [Op.in]: types },
        code,
        isUsed: 0,
        expireAt: { [Op.gt]: new Date() },
      },
      order: [['created_at', 'DESC']],
    });

    if (!record) {
      await this.recordVerifyFailure(phone);
      return false;
    }

    await (record as any).update({ isUsed: 1, usedAt: new Date() });
    return true;
  }

  /**
   * 标记验证码已使用
   */
  private async markCodeUsed(phone: string, code: string, type: string): Promise<void> {
    const { Op } = require('sequelize');
    await this.ctx.model.VerifyCode.update(
      { isUsed: 1, usedAt: new Date() } as any,
      { where: { target: phone, type, code, isUsed: 0, expireAt: { [Op.gt]: new Date() } } },
    );
  }

  /**
   * 记录验证失败次数
   */
  private async recordVerifyFailure(phone: string): Promise<void> {
    try {
      const lockKey = `verify:lock:${phone}`;
      const count = await this.app.redis.incr(lockKey);
      if (count === 1) {
        await this.app.redis.expire(lockKey, this.VERIFY_LOCK_TTL);
      }
    } catch {
      // Redis 不可用时跳过
    }
  }

  /**
   * 实际短信发送（模拟实现，待对接真实 SMS 服务商）
   */
  private async doSend(phone: string, code: string, type: string): Promise<void> {
    // TODO: 对接真实短信服务商（腾讯云短信 / 阿里云短信）
    // const smsConfig = (this.app.config as any).sms || {};
    // const provider = smsConfig.provider || 'tencent';
    // switch (provider) {
    //   case 'tencent': ...
    //   case 'aliyun': ...
    // }
    this.ctx.logger.info(`[SMS Mock] 发送验证码到 ${phone}: ${code}, 类型: ${type}`);
  }
}
