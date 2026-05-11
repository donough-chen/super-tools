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
   * 按业务模块分组返回权限树
   * 返回结构：[{ module: 'dashboard', name: '仪表盘', permissions: [权限树] }, ...]
   * 仅返回 P0 七大模块（dashboard/system/user/category/tool/feedback/stats）
   */
  async getTreeByModule(platform?: string) {
    const where: any = {};
    if (platform) where.platform = platform;
    const all = await this.ctx.model.Permission.findAll({
      where, order: [['sort', 'ASC'], ['id', 'ASC']],
    });
    const list: any[] = all.map((p: any) => p.toJSON());

    // 模块展示顺序与中文名
    const moduleMeta: Array<{ module: string; name: string }> = [
      { module: 'dashboard', name: '仪表盘' },
      { module: 'system',    name: '系统管理' },
      { module: 'user',      name: '用户管理' },
      { module: 'category',  name: '分类管理' },
      { module: 'tool',      name: '工具管理' },
      { module: 'feedback',  name: '反馈管理' },
      { module: 'stats',     name: '数据统计' },
    ];

    return moduleMeta.map(meta => {
      const modulePerms = list.filter(p => p.module === meta.module);
      // 在模块内部按 parentId 继续构树（模块内可能有多级）
      // 找出模块内的"根节点"（parent 不在本模块内视为根）
      const idsInModule = new Set(modulePerms.map(p => p.id));
      const roots = modulePerms.filter(p => !idsInModule.has(p.parentId));
      const rootIds = roots.map(r => r.id);
      const children = modulePerms.filter(p => !rootIds.includes(p.id));
      const trees = roots.map(root => ({
        ...root,
        children: this.buildTreeFromList(children, root.id),
      }));
      return { module: meta.module, name: meta.name, permissions: trees };
    });
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

  /**
   * 获取用户可见的菜单树（type=2，按用户权限过滤）
   * - super_admin 短路：返回所有 admin 平台 type=2 菜单
   * - 普通用户：取 type=2 ∩ 用户权限码
   * - 剪枝：父节点子菜单全空且本应有子节点 → 父节点也剪掉
   */
  async getMenusForUser(userId: number, platform = 'admin'): Promise<any[]> {
    const all = await this.ctx.model.Permission.findAll({
      where: { platform, type: 2, status: 1 },
      order: [['sort', 'ASC'], ['id', 'ASC']],
      attributes: ['id', 'code', 'name', 'module', 'path', 'icon', 'parentId', 'sort'],
    });
    const list: any[] = all.map((p: any) => p.toJSON());

    // super_admin 短路
    const userRoles = await this.service.role.getUserRoles(userId);
    const isSuperAdmin = userRoles.some((r: any) => r.code === 'super_admin');
    if (isSuperAdmin) return this.buildMenuTree(list, list, 0);

    const codes = await this.getUserPermissionCodes(userId);
    if (codes.length === 0) return [];
    const codeSet = new Set(codes);
    const owned = list.filter(m => codeSet.has(m.code));
    return this.buildMenuTree(owned, list, 0);
  }

  /**
   * 组菜单树 + 剪枝
   * @param owned 用户拥有的节点
   * @param raw 原始全量节点（用于剪枝判定）
   */
  private buildMenuTree(owned: any[], raw: any[], parentId: number): any[] {
    const result: any[] = [];
    for (const node of owned.filter(n => n.parentId === parentId)) {
      const children = this.buildMenuTree(owned, raw, node.id);
      const hasChildrenInRaw = raw.some(r => r.parentId === node.id);
      if (hasChildrenInRaw && children.length === 0) continue;
      result.push({
        id: node.id, code: node.code, name: node.name, module: node.module,
        path: node.path, icon: node.icon, sort: node.sort, children,
      });
    }
    return result;
  }

  private buildTree(list: any[], parentId: number): any[] {
    return list
      .filter(item => item.parentId === parentId)
      .map(item => ({ ...item, children: this.buildTree(list, item.id) }));
  }

  private buildTreeFromList(list: any[], parentId: number): any[] {
    return list
      .filter(item => item.parentId === parentId)
      .map(item => ({ ...item, children: this.buildTreeFromList(list, item.id) }));
  }

  // ============================================================
  // Spec-A1: 权限测试三 mode（user-overview / user-check / role-check）
  // ============================================================

  /**
   * Mode 1: 用户全景 — roles + codes + menus + stats
   */
  async testForUser(userId: number, platform = 'admin') {
    const user = await this.ctx.model.User.findByPk(userId, {
      attributes: ['id', 'username', 'nickname', 'status'],
    });
    if (!user) {
      return {
        user: null,
        roles: [],
        isSuperAdmin: false,
        permissionCodes: [],
        menus: [],
        stats: { totalCodes: 0, totalMenus: 0, byModule: {} },
      };
    }

    const roles = await this.service.role.getUserRoles(userId);
    const isSuperAdmin = roles.some((r: any) => r.code === 'super_admin');
    const permissionCodes = await this.getUserPermissionCodes(userId);
    const menus = await this.getMenusForUser(userId, platform);

    const byModule: Record<string, number> = {};
    if (permissionCodes.length > 0) {
      const perms = await this.ctx.model.Permission.findAll({
        where: { code: permissionCodes, platform },
        attributes: ['module'],
      });
      for (const p of perms) {
        const m = (p as any).module;
        byModule[m] = (byModule[m] || 0) + 1;
      }
    }

    return {
      user: (user as any).toJSON(),
      roles: roles.map((r: any) => ({ id: r.id, code: r.code, name: r.name })),
      isSuperAdmin,
      permissionCodes,
      menus,
      stats: {
        totalCodes: permissionCodes.length,
        totalMenus: this._countLeafMenus(menus),
        byModule,
      },
    };
  }

  /** 统计菜单树叶子节点数 */
  private _countLeafMenus(tree: any[]): number {
    let n = 0;
    for (const node of tree || []) {
      if (node.children && node.children.length > 0) {
        n += this._countLeafMenus(node.children);
      } else {
        n += 1;
      }
    }
    return n;
  }

  /**
   * Mode 2: 单接口/权限码命中检查
   * @param target 二选一：{code} 或 {path, method}
   */
  async checkUserAccess(
    userId: number,
    target: { code?: string; path?: string; method?: string },
  ) {
    // 1. 用户存在性 + 状态
    const user = await this.ctx.model.User.findByPk(userId, {
      attributes: ['id', 'username', 'status'],
    });
    if (!user) return this._buildDenyResult(null, target, 'user_not_found');
    if ((user as any).status !== 1) {
      return this._buildDenyResult((user as any).toJSON(), target, 'user_disabled');
    }

    // 2. 角色绑定（getUserRoles 已经只返回 status=1 的角色）
    const roles = await this.service.role.getUserRoles(userId);
    if (roles.length === 0) {
      return this._buildDenyResult((user as any).toJSON(), target, 'no_roles');
    }
    // service.role.getUserRoles 已 SQL 过滤 status=1；此处全部 roles 都视为有效
    const activeRoles = roles;

    // 3. super_admin 短路
    const isSuperAdmin = activeRoles.some((r: any) => r.code === 'super_admin');
    if (isSuperAdmin) {
      const resolved = await this._resolveTarget(target);
      const sa = activeRoles.find((r: any) => r.code === 'super_admin');
      return {
        user: { id: (user as any).id, username: (user as any).username },
        target: resolved.target,
        allowed: true,
        matchedRoles: [{ id: sa.id, code: 'super_admin', name: sa.name || '超级管理员' }],
        matchedPermissions: [{ via: 'super_admin_short_circuit' }],
        denyReason: null,
      };
    }

    // 4. 解析 target → permission 记录
    const resolved = await this._resolveTarget(target);
    if (!resolved.permission) {
      return this._buildDenyResult(
        (user as any).toJSON(), resolved.target, 'permission_not_exists',
      );
    }
    if ((resolved.permission as any).status !== 1) {
      return this._buildDenyResult(
        (user as any).toJSON(), resolved.target, 'permission_disabled',
      );
    }

    // 5. 用户权限码集合检查
    const codes = await this.getUserPermissionCodes(userId);
    const targetCode = (resolved.target as any).code;
    if (!codes.includes(targetCode)) {
      return this._buildDenyResult(
        (user as any).toJSON(), resolved.target, 'permission_not_granted',
      );
    }

    // 6. 命中：回填 matchedRoles + matchedPermissions
    const matched = await this._findMatchedRolesAndPermissions(userId, targetCode);
    return {
      user: { id: (user as any).id, username: (user as any).username },
      target: resolved.target,
      allowed: true,
      matchedRoles: matched.roles,
      matchedPermissions: matched.permissions,
      denyReason: null,
    };
  }

  /** 解析 target → permission 记录 */
  private async _resolveTarget(target: { code?: string; path?: string; method?: string }) {
    let permission: any = null;
    let resolvedTarget: any = { ...target };

    if (target.code) {
      permission = await this.ctx.model.Permission.findOne({
        where: { code: target.code, platform: 'admin' },
      });
      resolvedTarget = {
        type: 'code',
        code: target.code,
        permissionExists: !!permission,
        permissionId: permission?.id,
        permissionName: permission?.name,
      };
    } else if (target.path && target.method) {
      permission = await this.ctx.model.Permission.findOne({
        where: {
          path: target.path,
          method: target.method.toUpperCase(),
          platform: 'admin',
        },
        order: [['sort', 'ASC'], ['id', 'ASC']],
      });
      resolvedTarget = {
        type: 'api',
        path: target.path,
        method: target.method.toUpperCase(),
        code: permission?.code,
        permissionExists: !!permission,
        permissionId: permission?.id,
        permissionName: permission?.name,
      };
    }

    return { target: resolvedTarget, permission };
  }

  /** 构造拒绝结果 */
  private _buildDenyResult(user: any, target: any, denyReason: string) {
    return {
      user: user ? { id: user.id, username: user.username } : null,
      target,
      allowed: false,
      matchedRoles: [],
      matchedPermissions: [],
      denyReason,
    };
  }

  /** 查询命中的 roles + permissions */
  private async _findMatchedRolesAndPermissions(userId: number, code: string) {
    const sql = `
      SELECT r.id AS role_id, r.code AS role_code, r.name AS role_name,
             p.id AS perm_id, p.code AS perm_code
      FROM roles r
      INNER JOIN role_permissions rp ON r.id = rp.role_id
      INNER JOIN permissions p       ON p.id = rp.permission_id
      INNER JOIN user_roles ur       ON ur.role_id = r.id
      WHERE ur.user_id = :userId
        AND p.code = :code
        AND r.status = 1
        AND p.status = 1
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { userId, code },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];

    const roleMap = new Map<number, any>();
    const permList: any[] = [];
    for (const row of rows) {
      if (!roleMap.has(row.role_id)) {
        roleMap.set(row.role_id, {
          id: row.role_id, code: row.role_code, name: row.role_name,
        });
      }
      permList.push({
        id: row.perm_id, code: row.perm_code, via: `role:${row.role_code}`,
      });
    }
    return {
      roles: Array.from(roleMap.values()),
      permissions: permList,
    };
  }

  /**
   * Mode 3: 角色权限矩阵 + 影响面（绑定用户数）
   */
  async testForRole(input: { roleCode?: string; roleId?: number }) {
    const where: any = {};
    if (input.roleId) where.id = input.roleId;
    else if (input.roleCode) where.code = input.roleCode;
    else throw new Error('roleCode or roleId required');

    const role = await this.ctx.model.Role.findOne({ where });
    if (!role) {
      return {
        role: null, ownedCodes: [], permissionTree: [],
        stats: { total: 0, byModule: {}, byType: {} },
        boundUserCount: 0,
      };
    }

    const sql = `
      SELECT p.id, p.code, p.name, p.type, p.module, p.path, p.icon, p.parent_id, p.sort
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = :roleId AND p.platform = 'admin' AND p.status = 1
      ORDER BY p.sort ASC, p.id ASC
    `;
    const owned: any[] = (await (this.app as any).model.query(sql, {
      replacements: { roleId: (role as any).id },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];

    const ownedCodes = owned.map((p: any) => p.code);
    const byModule: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const p of owned) {
      byModule[p.module] = (byModule[p.module] || 0) + 1;
      const typeName = p.type === 2 ? 'menu'
        : p.type === 4 ? 'api'
        : p.type === 1 ? 'group'
        : `type${p.type}`;
      byType[typeName] = (byType[typeName] || 0) + 1;
    }

    // 字段名 parent_id → parentId 后再 buildTree
    const ownedNormalized = owned.map((p: any) => ({ ...p, parentId: p.parent_id }));
    const permissionTree = this.buildTree(ownedNormalized, 0);

    const boundUserCount = await this.ctx.model.UserRole.count({
      where: { roleId: (role as any).id },
    });

    return {
      role: {
        id: (role as any).id,
        code: (role as any).code,
        name: (role as any).name,
        status: (role as any).status,
      },
      ownedCodes,
      permissionTree,
      stats: {
        total: owned.length,
        byModule,
        byType,
      },
      boundUserCount,
    };
  }
}
