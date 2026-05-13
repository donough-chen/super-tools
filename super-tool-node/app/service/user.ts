import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import BaseService, { PaginationOptions, PaginationResult } from './base';

export default class UserService extends BaseService {
  private readonly CACHE_PREFIX = 'user:';
  private readonly CACHE_TTL = 600;

  async create(dto: any) {
    const { username, email, password, phone, nickname, registerSource } = dto;
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
      registerSource: registerSource || 'admin', registerIp: this.ctx.ip,
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
    const { keyword, status, registerSource, startDate, endDate, ...pagination } = query;
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
    if (registerSource !== undefined) where.registerSource = registerSource;
    if (startDate && endDate) where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    return this.paginate(this.ctx.model.User, {
      where,
      attributes: { exclude: ['password_hash'] },
      include: [{ model: this.ctx.model.Role, as: 'roles', attributes: ['id', 'name', 'code'], through: { attributes: [] } }],
    }, pagination);
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

  async changePassword(id: number, oldPassword: string | undefined, newPassword: string) {
    const user = await this.ctx.model.User.findByPk(id);
    if (!user) this.ctx.throw(404, '用户不存在');
    const userData = (user as any).toJSON();

    if (userData.passwordHash) {
      // 已设密码：必须校验原密码（防止未持有 oldPassword 的攻击者绕过）
      if (!oldPassword) this.ctx.throw(400, '请输入原密码');
      const isValid = await bcrypt.compare(oldPassword, userData.passwordHash);
      if (!isValid) this.ctx.throw(400, '原密码错误');
      // 防止设置与原密码相同
      const isSame = await bcrypt.compare(newPassword, userData.passwordHash);
      if (isSame) this.ctx.throw(400, '新密码不能与原密码相同');
    }
    // 未设密码（手机号/微信首次登录场景）：直接落库，等同"首次设置密码"

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

  // ===== Spec-C2a：管理端用户行为 =====

  /**
   * admin 重置任意用户密码
   * - 不允许 admin 改自己（应走 changePassword）
   * - 不记审计明文（仅记 bizId；newPassword 由 audit._sanitizeParams 自动脱敏）
   */
  async adminResetPassword(adminId: number, targetUserId: number, newPassword: string) {
    if (adminId === targetUserId) {
      this.ctx.throw(400, '请通过"修改密码"修改自己的密码');
    }
    const user = await this.ctx.model.User.findByPk(targetUserId);
    if (!user) this.ctx.throw(404, '用户不存在');

    await (user as any).update({
      passwordHash: await bcrypt.hash(newPassword, 12),
    });
    await this.clearCache(`${this.CACHE_PREFIX}${targetUserId}`);
  }

  /**
   * admin 切换任意用户启用/禁用
   * - 不允许 admin 禁用自己
   * - 返回剔除敏感字段的用户对象
   */
  async adminChangeStatus(adminId: number, targetUserId: number, status: 0 | 1) {
    if (![0, 1].includes(status)) this.ctx.throw(422, 'status must be 0 or 1');
    if (adminId === targetUserId && status === 0) {
      this.ctx.throw(400, '不能禁用自己的账户');
    }
    const user = await this.ctx.model.User.findByPk(targetUserId);
    if (!user) this.ctx.throw(404, '用户不存在');

    await (user as any).update({ status });
    await this.clearCache(`${this.CACHE_PREFIX}${targetUserId}`);
    const result = (user as any).toJSON();
    delete result.passwordHash;
    return result;
  }

  /**
   * 为用户分配角色（全量替换，排除 super_admin）
   */
  async assignRoles(adminId: number, targetUserId: number, roleIds: number[]) {
    if (adminId === targetUserId) {
      this.ctx.throw(400, '不能修改自己的角色');
    }

    const user = await this.ctx.model.User.findByPk(targetUserId);
    if (!user) this.ctx.throw(404, '用户不存在');

    // 查找 super_admin 角色 ID，排除保护
    const superAdminRole = await this.ctx.model.Role.findOne({ where: { code: 'super_admin' } });
    const superAdminRoleId = superAdminRole ? (superAdminRole as any).id : null;

    // 过滤掉 super_admin
    const safeRoleIds = roleIds.filter(id => id !== superAdminRoleId);

    // 验证所有 roleIds 存在且启用
    if (safeRoleIds.length > 0) {
      const validRoles = await this.ctx.model.Role.findAll({
        where: { id: safeRoleIds, status: 1 },
      });
      if (validRoles.length !== safeRoleIds.length) {
        this.ctx.throw(400, '部分角色不存在或已停用');
      }
    }

    const { Op } = require('sequelize');

    // 事务内全量替换（保留 super_admin 绑定不动）
    await this.ctx.model.transaction(async (t: any) => {
      const deleteWhere: any = { userId: targetUserId };
      if (superAdminRoleId) {
        deleteWhere.roleId = { [Op.ne]: superAdminRoleId };
      }
      await this.ctx.model.UserRole.destroy({ where: deleteWhere, transaction: t });

      if (safeRoleIds.length > 0) {
        await this.ctx.model.UserRole.bulkCreate(
          safeRoleIds.map(roleId => ({ userId: targetUserId, roleId, grantedBy: adminId })),
          { transaction: t },
        );
      }
    });

    await this.clearCache('user:permissions:*');
    await this.clearCache(`${this.CACHE_PREFIX}${targetUserId}`);

    const newRoles = await this.service.role.getUserRoles(targetUserId);
    return { userId: targetUserId, roles: newRoles };
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
