import BaseService, { PaginationResult } from './base';

export default class RoleService extends BaseService {

  async create(dto: any) {
    const existing = await this.ctx.model.Role.findOne({ where: { code: dto.code } });
    if (existing) this.ctx.throw(400, '角色编码已存在');
    return (await this.ctx.model.Role.create(dto)).toJSON();
  }

  async findById(id: number) {
    const role = await this.ctx.model.Role.findByPk(id, {
      include: [{ model: this.ctx.model.Permission, as: 'permissions', attributes: ['id', 'name', 'code', 'type'], through: { attributes: [] } }],
    });
    if (!role) this.ctx.throw(404, '角色不存在');
    return (role as any).toJSON();
  }

  async findList(query: any): Promise<PaginationResult<any>> {
    const { keyword, status, platform, ...pagination } = query;
    const { Op } = require('sequelize');
    const where: any = {};
    if (keyword) where.name = { [Op.like]: `%${keyword}%` };
    if (status !== undefined) where.status = status;
    if (platform) where.platform = platform;
    return this.paginate(this.ctx.model.Role, { where }, pagination);
  }

  async update(id: number, dto: any) {
    const role = await this.ctx.model.Role.findByPk(id);
    if (!role) this.ctx.throw(404, '角色不存在');
    await (role as any).update(dto);
    return (role as any).toJSON();
  }

  async delete(id: number) {
    const role = await this.ctx.model.Role.findByPk(id);
    if (!role) this.ctx.throw(404, '角色不存在');
    if ((role as any).type === 1) this.ctx.throw(400, '系统角色不可删除');
    await (role as any).destroy();
  }

  async assignPermissions(roleId: number, permissionIds: number[]) {
    const role = await this.ctx.model.Role.findByPk(roleId);
    if (!role) this.ctx.throw(404, '角色不存在');
    // 先删后插
    await this.ctx.model.RolePermission.destroy({ where: { roleId } });
    if (permissionIds.length > 0) {
      await this.ctx.model.RolePermission.bulkCreate(
        permissionIds.map(pid => ({ roleId, permissionId: pid })) as any,
      );
    }
    // 清除所有用户权限缓存
    await this.clearCache('user:permissions:*');
  }

  async assignUsers(roleId: number, userIds: number[], grantedBy?: number) {
    const role = await this.ctx.model.Role.findByPk(roleId);
    if (!role) this.ctx.throw(404, '角色不存在');
    for (const userId of userIds) {
      await this.ctx.model.UserRole.findOrCreate({
        where: { userId, roleId },
        defaults: { userId, roleId, grantedBy } as any,
      });
    }
  }
}
