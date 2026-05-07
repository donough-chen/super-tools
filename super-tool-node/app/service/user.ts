import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import BaseService, { PaginationOptions, PaginationResult } from './base';

export default class UserService extends BaseService {
  private readonly CACHE_PREFIX = 'user:';
  private readonly CACHE_TTL = 600;

  async create(dto: any) {
    const { username, email, password, phone, nickname, userType, registerSource } = dto;
    const { Op } = require('sequelize');
    const conditions: any[] = [];
    if (username) conditions.push({ username });
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phone });

    if (conditions.length) {
      const existing = await this.ctx.model.User.findOne({ where: { [Op.or]: conditions } });
      if (existing) this.ctx.throw(400, '用户名/邮箱/手机号已存在');
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const user = await this.ctx.model.User.create({
      uuid: uuidv4(), username, email, phone, passwordHash, nickname,
      userType: userType || 1, registerSource: registerSource || 'web', registerIp: this.ctx.ip,
    } as any);

    await this.clearCache(`${this.CACHE_PREFIX}list:*`);
    const result = (user as any).toJSON();
    delete result.passwordHash;
    return result;
  }

  async findById(id: number) {
    return this.getOrSetCache(`${this.CACHE_PREFIX}${id}`, async () => {
      const user = await this.ctx.model.User.findByPk(id, {
        attributes: { exclude: ['password_hash'] },
        include: [{ model: this.ctx.model.Role, as: 'roles', attributes: ['id', 'name', 'code'], through: { attributes: [] } }],
      });
      return user ? (user as any).toJSON() : null;
    }, this.CACHE_TTL);
  }

  async findList(query: any): Promise<PaginationResult<any>> {
    const { keyword, status, userType, startDate, endDate, ...pagination } = query;
    const { Op } = require('sequelize');
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { email: { [Op.like]: `%${keyword}%` } },
        { nickname: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (status !== undefined) where.status = status;
    if (userType !== undefined) where.userType = userType;
    if (startDate && endDate) where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    return this.paginate(this.ctx.model.User, { where, attributes: { exclude: ['password_hash'] } }, pagination);
  }

  async update(id: number, dto: any) {
    const user = await this.ctx.model.User.findByPk(id);
    if (!user) this.ctx.throw(404, '用户不存在');
    await (user as any).update(dto);
    await this.clearCache(`${this.CACHE_PREFIX}${id}`);
    const result = (user as any).toJSON();
    delete result.passwordHash;
    return result;
  }

  async delete(id: number) {
    const user = await this.ctx.model.User.findByPk(id);
    if (!user) this.ctx.throw(404, '用户不存在');
    await (user as any).destroy();
    await this.clearCache(`${this.CACHE_PREFIX}${id}`);
  }

  async changePassword(id: number, oldPassword: string, newPassword: string) {
    const user = await this.ctx.model.User.findByPk(id);
    if (!user) this.ctx.throw(404, '用户不存在');
    const userData = (user as any).toJSON();
    if (userData.passwordHash) {
      const isValid = await bcrypt.compare(oldPassword, userData.passwordHash);
      if (!isValid) this.ctx.throw(400, '原密码错误');
    }
    await (user as any).update({ passwordHash: await bcrypt.hash(newPassword, 12) });
  }

  // ===== 用户扩展信息 (Profile) =====

  /**
   * 获取用户完整资料（基础 + 扩展）
   */
  async getProfileExtra(userId: number) {
    const user = await this.ctx.model.User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: this.ctx.model.Role, as: 'roles', attributes: ['id', 'name', 'code'], through: { attributes: [] } },
      ],
    });
    if (!user) this.ctx.throw(404, '用户不存在');

    // 获取 profile 扩展信息
    let profile = await this.ctx.model.UserProfile.findOne({ where: { userId } });
    if (!profile) {
      // 如果没有 profile 则自动创建
      profile = await this.ctx.model.UserProfile.create({
        userId,
        referralCode: this.generateReferralCode(),
      } as any);
    }

    const userData = (user as any).toJSON();
    const profileData = (profile as any).toJSON();

    return {
      ...userData,
      profile: {
        bio: profileData.bio,
        signature: profileData.signature,
        regionCode: profileData.regionCode,
        language: profileData.language,
        timezone: profileData.timezone,
        referralCode: profileData.referralCode,
        invitedBy: profileData.invitedBy,
        privacySettings: profileData.privacySettings,
        notificationSettings: profileData.notificationSettings,
      },
    };
  }

  /**
   * 更新用户扩展信息
   */
  async updateProfile(userId: number, dto: {
    nickname?: string;
    avatar?: string;
    gender?: number;
    birthday?: string;
    bio?: string;
    signature?: string;
    regionCode?: string;
    language?: string;
    timezone?: string;
    privacySettings?: object;
    notificationSettings?: object;
  }) {
    const user = await this.ctx.model.User.findByPk(userId);
    if (!user) this.ctx.throw(404, '用户不存在');

    // 更新基础信息（users 表字段）
    const baseFields: any = {};
    if (dto.nickname !== undefined) baseFields.nickname = dto.nickname;
    if (dto.avatar !== undefined) baseFields.avatar = dto.avatar;
    if (dto.gender !== undefined) baseFields.gender = dto.gender;
    if (dto.birthday !== undefined) baseFields.birthday = dto.birthday;
    if (Object.keys(baseFields).length > 0) {
      await (user as any).update(baseFields);
    }

    // 更新扩展信息（user_profiles 表字段）
    const profileFields: any = {};
    if (dto.bio !== undefined) profileFields.bio = dto.bio;
    if (dto.signature !== undefined) profileFields.signature = dto.signature;
    if (dto.regionCode !== undefined) profileFields.regionCode = dto.regionCode;
    if (dto.language !== undefined) profileFields.language = dto.language;
    if (dto.timezone !== undefined) profileFields.timezone = dto.timezone;
    if (dto.privacySettings !== undefined) profileFields.privacySettings = dto.privacySettings;
    if (dto.notificationSettings !== undefined) profileFields.notificationSettings = dto.notificationSettings;

    if (Object.keys(profileFields).length > 0) {
      const [profile, created] = await this.ctx.model.UserProfile.findOrCreate({
        where: { userId },
        defaults: { userId, ...profileFields, referralCode: this.generateReferralCode() } as any,
      });
      if (!created) {
        await (profile as any).update(profileFields);
      }
    }

    // 清除缓存
    await this.clearCache(`${this.CACHE_PREFIX}${userId}`);

    return this.getProfileExtra(userId);
  }

  // ===== 设备管理 =====

  /**
   * 注册/更新设备
   */
  async registerDevice(userId: number, dto: {
    deviceId: string;
    deviceName?: string;
    deviceType: string;
    osVersion?: string;
    appVersion?: string;
    pushToken?: string;
  }) {
    const [device, created] = await this.ctx.model.UserDevice.findOrCreate({
      where: { userId, deviceId: dto.deviceId },
      defaults: {
        userId,
        ...dto,
        lastActiveAt: new Date(),
      } as any,
    });

    if (!created) {
      // 更新已有设备信息
      await (device as any).update({
        deviceName: dto.deviceName || (device as any).deviceName,
        osVersion: dto.osVersion || (device as any).osVersion,
        appVersion: dto.appVersion || (device as any).appVersion,
        pushToken: dto.pushToken !== undefined ? dto.pushToken : (device as any).pushToken,
        lastActiveAt: new Date(),
        status: 1,
      });
    }

    return (device as any).toJSON();
  }

  /**
   * 获取用户设备列表
   */
  async listDevices(userId: number) {
    const devices = await this.ctx.model.UserDevice.findAll({
      where: { userId, status: 1 },
      order: [['last_active_at', 'DESC']],
    });
    return devices.map((d: any) => d.toJSON());
  }

  /**
   * 删除设备
   */
  async removeDevice(userId: number, deviceId: string) {
    const device = await this.ctx.model.UserDevice.findOne({
      where: { userId, deviceId },
    });
    if (!device) this.ctx.throw(404, '设备不存在');
    await (device as any).update({ status: 0 });
    return { message: '设备已移除' };
  }

  /**
   * 更新推送设置
   */
  async updatePushSettings(userId: number, deviceId: string, pushEnabled: boolean) {
    const device = await this.ctx.model.UserDevice.findOne({
      where: { userId, deviceId, status: 1 },
    });
    if (!device) this.ctx.throw(404, '设备不存在');
    await (device as any).update({ pushEnabled: pushEnabled ? 1 : 0 });
    return (device as any).toJSON();
  }

  // ===== 地址管理 =====
  async listAddresses(userId: number) {
    return (await this.ctx.model.UserAddress.findAll({
      where: { userId }, order: [['is_default', 'DESC'], ['created_at', 'DESC']],
    })).map((a: any) => a.toJSON());
  }

  async addAddress(userId: number, dto: any) {
    if (dto.isDefault) {
      await this.ctx.model.UserAddress.update({ isDefault: 0 } as any, { where: { userId } });
    }
    return (await this.ctx.model.UserAddress.create({ ...dto, userId } as any)).toJSON();
  }

  async updateAddress(userId: number, id: number, dto: any) {
    const addr = await this.ctx.model.UserAddress.findOne({ where: { id, userId } });
    if (!addr) this.ctx.throw(404, '地址不存在');
    if (dto.isDefault) {
      await this.ctx.model.UserAddress.update({ isDefault: 0 } as any, { where: { userId } });
    }
    await (addr as any).update(dto);
    return (addr as any).toJSON();
  }

  async deleteAddress(userId: number, id: number) {
    const addr = await this.ctx.model.UserAddress.findOne({ where: { id, userId } });
    if (!addr) this.ctx.throw(404, '地址不存在');
    await (addr as any).destroy();
  }

  // ===== 工具方法 =====

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
