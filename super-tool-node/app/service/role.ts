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

  /**
   * 获取角色已绑定的用户列表（分页）
   */
  async getRoleUsers(roleId: number, query: any): Promise<PaginationResult<any>> {
    const role = await this.ctx.model.Role.findByPk(roleId);
    if (!role) this.ctx.throw(404, '角色不存在');

    const { keyword, ...pagination } = query;
    const { Op } = require('sequelize');

    const userRoleRows = await this.ctx.model.UserRole.findAll({
      where: { roleId },
      attributes: ['userId'],
    });
    const userIds = userRoleRows.map((ur: any) => ur.userId);
    if (userIds.length === 0) {
      return { list: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    const where: any = { id: userIds };
    if (keyword) {
      where[Op.and] = [{
        [Op.or]: [
          { username: { [Op.like]: `%${keyword}%` } },
          { nickname: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } },
          { phone: { [Op.like]: `%${keyword}%` } },
        ],
      }];
    }

    return this.paginate(this.ctx.model.User, {
      where,
      attributes: ['id', 'username', 'nickname', 'email', 'phone', 'avatar', 'status'],
    }, pagination);
  }

  /**
   * 从角色移除单个用户
   */
  async removeUser(roleId: number, userId: number) {
    const role = await this.ctx.model.Role.findByPk(roleId);
    if (!role) this.ctx.throw(404, '角色不存在');
    if ((role as any).code === 'super_admin') {
      this.ctx.throw(400, '不能通过此接口操作超级管理员角色');
    }

    const deleted = await this.ctx.model.UserRole.destroy({
      where: { roleId, userId },
    });
    if (!deleted) this.ctx.throw(404, '该用户未绑定此角色');

    await this.clearCache('user:permissions:*');
  }

  /**
   * 获取用户当前有效的角色列表（含未过期绑定）
   * 返回：[{ id, code, name, type }]
   */
  async getUserRoles(userId: number) {
    const { Op } = require('sequelize');
    const userRoles = await this.ctx.model.UserRole.findAll({
      where: {
        userId,
        [Op.or]: [{ expireAt: null }, { expireAt: { [Op.gt]: new Date() } }],
      },
    });
    const roleIds = userRoles.map((ur: any) => ur.roleId);
    if (roleIds.length === 0) return [];
    const roles = await this.ctx.model.Role.findAll({
      where: { id: roleIds, status: 1 },
      attributes: ['id', 'code', 'name', 'type'],
      order: [['sort', 'ASC'], ['id', 'ASC']],
    });
    return roles.map((r: any) => r.toJSON());
  }
}
