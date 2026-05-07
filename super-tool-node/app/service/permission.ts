import BaseService from './base';

export default class PermissionService extends BaseService {

  async create(dto: any) {
    const existing = await this.ctx.model.Permission.findOne({ where: { code: dto.code } });
    if (existing) this.ctx.throw(400, '权限编码已存在');
    return (await this.ctx.model.Permission.create(dto)).toJSON();
  }

  async findById(id: number) {
    const perm = await this.ctx.model.Permission.findByPk(id);
    if (!perm) this.ctx.throw(404, '权限不存在');
    return (perm as any).toJSON();
  }

  async update(id: number, dto: any) {
    const perm = await this.ctx.model.Permission.findByPk(id);
    if (!perm) this.ctx.throw(404, '权限不存在');
    await (perm as any).update(dto);
    return (perm as any).toJSON();
  }

  async delete(id: number) {
    // 检查是否有子权限
    const children = await this.ctx.model.Permission.count({ where: { parentId: id } });
    if (children > 0) this.ctx.throw(400, '存在子权限，无法删除');
    const perm = await this.ctx.model.Permission.findByPk(id);
    if (!perm) this.ctx.throw(404, '权限不存在');
    await (perm as any).destroy();
    await this.clearCache('user:permissions:*');
  }

  /**
   * 获取权限树
   */
  async getTree(platform?: string) {
    const where: any = {};
    if (platform) where.platform = platform;
    const all = await this.ctx.model.Permission.findAll({
      where, order: [['sort', 'ASC'], ['id', 'ASC']],
    });
    const list = all.map((p: any) => p.toJSON());
    return this.buildTree(list, 0);
  }

  /**
   * 获取用户全部权限编码（角色权限 + 直接授权 - 拒绝）
   */
  async getUserPermissionCodes(userId: number): Promise<string[]> {
    // 先查缓存
    try {
      const cached = await this.app.redis.get(`user:permissions:${userId}`);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }

    const { Op } = require('sequelize');

    // 1. 通过角色获取权限
    const userRoles = await this.ctx.model.UserRole.findAll({
      where: {
        userId,
        [Op.or]: [{ expireAt: null }, { expireAt: { [Op.gt]: new Date() } }],
      },
    });
    const roleIds = userRoles.map((ur: any) => ur.roleId);

    let permCodes: Set<string> = new Set();
    if (roleIds.length > 0) {
      const rolePerms = await this.ctx.model.RolePermission.findAll({ where: { roleId: roleIds } });
      const permIds = rolePerms.map((rp: any) => rp.permissionId);
      if (permIds.length > 0) {
        const perms = await this.ctx.model.Permission.findAll({ where: { id: permIds, status: 1 }, attributes: ['code'] });
        perms.forEach((p: any) => permCodes.add(p.code));
      }
    }

    // 2. 用户直接授权（effect=1 添加，effect=0 移除）
    const userPerms = await this.ctx.model.UserPermission.findAll({
      where: {
        userId,
        [Op.or]: [{ expireAt: null }, { expireAt: { [Op.gt]: new Date() } }],
      },
    });
    for (const up of userPerms) {
      const upData = (up as any).toJSON();
      const perm = await this.ctx.model.Permission.findByPk(upData.permissionId, { attributes: ['code'] });
      if (!perm) continue;
      if (upData.effect === 1) permCodes.add((perm as any).code);
      else permCodes.delete((perm as any).code);
    }

    const codes = Array.from(permCodes);
    // 写缓存
    try { await this.app.redis.setex(`user:permissions:${userId}`, 3600, JSON.stringify(codes)); } catch { /* ignore */ }
    return codes;
  }

  private buildTree(list: any[], parentId: number): any[] {
    return list
      .filter(item => item.parentId === parentId)
      .map(item => ({ ...item, children: this.buildTree(list, item.id) }));
  }
}
