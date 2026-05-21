import { Service } from 'egg';
import { Op } from 'sequelize';

export interface CategoryCreatePayload {
  parentId?: number | null;
  code: string;
  name: string;
  description?: string | null;
  feedbackType?: 'bug' | 'suggestion' | 'praise' | 'other' | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  status?: 0 | 1;
}

export interface CategoryUpdatePayload {
  parentId?: number | null;
  name?: string;
  description?: string | null;
  feedbackType?: 'bug' | 'suggestion' | 'praise' | 'other' | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  status?: 0 | 1;
}

interface CategoryNode {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  description: string | null;
  feedbackType: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  status: number;
  isSystem: number;
  children: CategoryNode[];
}

/**
 * 反馈话术分类 Service
 * - 树形分类（parent_id）
 * - 角色级访问权限（feedback_snippet_role_permissions）
 */
export default class FeedbackSnippetCategoryService extends Service {
  /**
   * 获取分类树（含所有节点，前端组装）
   * @param onlyActive 只返回 status=1 的节点
   */
  async tree(onlyActive = false): Promise<CategoryNode[]> {
    const Model = this.ctx.model.FeedbackSnippetCategory as any;
    const where: any = {};
    if (onlyActive) where.status = 1;

    const rows = await Model.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const flat: CategoryNode[] = rows.map((r: any) => ({
      id: r.id,
      parentId: r.parent_id,
      code: r.code,
      name: r.name,
      description: r.description,
      feedbackType: r.feedback_type,
      icon: r.icon,
      color: r.color,
      sortOrder: r.sort_order,
      status: r.status,
      isSystem: r.is_system,
      children: [],
    }));

    const map = new Map<number, CategoryNode>();
    flat.forEach(n => map.set(n.id, n));

    const roots: CategoryNode[] = [];
    flat.forEach(n => {
      if (n.parentId && map.has(n.parentId)) {
        map.get(n.parentId)!.children.push(n);
      } else {
        roots.push(n);
      }
    });

    return roots;
  }

  /**
   * 单个分类详情
   */
  async detail(id: number) {
    const row = await (this.ctx.model.FeedbackSnippetCategory as any).findByPk(id);
    if (!row) this.ctx.throw(404, '分类不存在');
    return row;
  }

  /**
   * 新建分类
   */
  async create(payload: CategoryCreatePayload, operatorId: number) {
    const Model = this.ctx.model.FeedbackSnippetCategory as any;

    // code 唯一性校验
    const dup = await Model.findOne({ where: { code: payload.code } });
    if (dup) this.ctx.throw(409, `分类 code "${payload.code}" 已存在`);

    // 父分类校验
    if (payload.parentId) {
      const parent = await Model.findByPk(payload.parentId);
      if (!parent) this.ctx.throw(422, '父分类不存在');
    }

    const row = await Model.create({
      parent_id: payload.parentId || null,
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
      feedback_type: payload.feedbackType || null,
      icon: payload.icon || null,
      color: payload.color || null,
      sort_order: payload.sortOrder ?? 0,
      status: payload.status ?? 1,
      is_system: 0,
      created_by: operatorId,
      updated_by: operatorId,
    });
    return row;
  }

  /**
   * 编辑分类
   */
  async update(id: number, payload: CategoryUpdatePayload, operatorId: number) {
    const Model = this.ctx.model.FeedbackSnippetCategory as any;
    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '分类不存在');

    // 系统预置分类禁止改 code/parent
    if (row.is_system && payload.parentId !== undefined && payload.parentId !== row.parent_id) {
      this.ctx.throw(422, '系统预置分类禁止修改父分类');
    }

    // 防止把自己设成自己后代的子节点
    if (payload.parentId && payload.parentId === id) {
      this.ctx.throw(422, '不能将自己设为父分类');
    }
    if (payload.parentId) {
      const isDescendant = await this._isDescendant(payload.parentId, id);
      if (isDescendant) this.ctx.throw(422, '不能将子孙节点设为父分类');
    }

    const updates: any = { updated_by: operatorId };
    if (payload.parentId !== undefined) updates.parent_id = payload.parentId;
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.feedbackType !== undefined) updates.feedback_type = payload.feedbackType;
    if (payload.icon !== undefined) updates.icon = payload.icon;
    if (payload.color !== undefined) updates.color = payload.color;
    if (payload.sortOrder !== undefined) updates.sort_order = payload.sortOrder;
    if (payload.status !== undefined) updates.status = payload.status;

    await row.update(updates);
    return row;
  }

  /**
   * 删除分类（软删，校验：分类下不能有未软删话术，不能是系统预置）
   */
  async destroy(id: number) {
    const Model = this.ctx.model.FeedbackSnippetCategory as any;
    const SnippetModel = this.ctx.model.FeedbackSnippet as any;

    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '分类不存在');
    if (row.is_system) this.ctx.throw(422, '系统预置分类不可删除');

    // 子分类校验
    const childCount = await Model.count({ where: { parent_id: id } });
    if (childCount > 0) this.ctx.throw(422, '该分类下还有子分类，请先删除子分类');

    // 话术校验
    const snippetCount = await SnippetModel.count({ where: { category_id: id } });
    if (snippetCount > 0) this.ctx.throw(422, '该分类下还有话术，请先迁移或删除话术');

    await row.destroy();
    return { id };
  }

  /**
   * 配置分类的角色访问权限（覆盖式）
   * @param categoryId 分类 ID
   * @param roleIds 允许访问的角色 ID 列表（空数组 = 清空 = 所有角色都可见）
   */
  async setRolePermissions(categoryId: number, roleIds: number[]) {
    const Model = this.ctx.model.FeedbackSnippetCategory as any;
    const cat = await Model.findByPk(categoryId);
    if (!cat) this.ctx.throw(404, '分类不存在');

    const sequelize = (this.app as any).model;
    const t = await sequelize.transaction();
    try {
      // 清空旧的
      await sequelize.query(
        'DELETE FROM feedback_snippet_role_permissions WHERE category_id = ?',
        { replacements: [categoryId], transaction: t },
      );

      if (roleIds.length > 0) {
        // 校验 roleId 存在
        const RoleModel = this.ctx.model.Role as any;
        const validRoles = await RoleModel.findAll({
          where: { id: { [Op.in]: roleIds } },
          attributes: ['id'],
          transaction: t,
        });
        if (validRoles.length !== roleIds.length) {
          this.ctx.throw(422, '存在无效的 roleId');
        }

        const values = roleIds.map(rid => `(${categoryId}, ${rid})`).join(',');
        await sequelize.query(
          `INSERT INTO feedback_snippet_role_permissions (category_id, role_id) VALUES ${values}`,
          { transaction: t },
        );
      }

      await t.commit();
      return { categoryId, roleIds };
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  /**
   * 查询分类的角色访问权限
   */
  async getRolePermissions(categoryId: number): Promise<number[]> {
    const sequelize = (this.app as any).model;
    const [rows] = await sequelize.query(
      'SELECT role_id FROM feedback_snippet_role_permissions WHERE category_id = ?',
      { replacements: [categoryId] },
    );
    return (rows as any[]).map(r => r.role_id);
  }

  /**
   * 当前用户可访问的分类 ID 列表
   * - 用户角色匹配 → 允许访问
   * - 分类未配置任何 role_permission → 默认所有角色都可访问
   */
  async accessibleCategoryIds(userId: number): Promise<number[]> {
    const sequelize = (this.app as any).model;

    // 1. 取用户所有角色 ID
    const [roleRows] = await sequelize.query(
      'SELECT role_id FROM user_roles WHERE user_id = ?',
      { replacements: [userId] },
    );
    const roleIds = (roleRows as any[]).map(r => r.role_id);

    // 2. 取所有分类
    const Model = this.ctx.model.FeedbackSnippetCategory as any;
    const allCats = await Model.findAll({
      where: { status: 1 },
      attributes: ['id'],
    });
    const allIds = allCats.map((c: any) => c.id);
    if (allIds.length === 0) return [];

    // 3. 取已配置 role_permission 的分类 ID
    const [restrictedRows] = await sequelize.query(
      'SELECT DISTINCT category_id FROM feedback_snippet_role_permissions WHERE category_id IN (?)',
      { replacements: [allIds] },
    );
    const restrictedIds = new Set<number>((restrictedRows as any[]).map(r => r.category_id));

    if (restrictedIds.size === 0) return allIds;

    // 4. 从已配置的分类中筛选用户角色匹配的
    let allowedRestrictedIds: number[] = [];
    if (roleIds.length > 0) {
      const [allowedRows] = await sequelize.query(
        'SELECT DISTINCT category_id FROM feedback_snippet_role_permissions WHERE role_id IN (?) AND category_id IN (?)',
        { replacements: [roleIds, Array.from(restrictedIds)] },
      );
      allowedRestrictedIds = (allowedRows as any[]).map(r => r.category_id);
    }

    // 5. 合并：未配置的分类 + 已配置且匹配的分类
    return allIds.filter((id: number) => !restrictedIds.has(id) || allowedRestrictedIds.includes(id));
  }

  /**
   * 私有：判断 candidateId 是否是 nodeId 的后代
   */
  private async _isDescendant(candidateId: number, nodeId: number): Promise<boolean> {
    const Model = this.ctx.model.FeedbackSnippetCategory as any;
    let current = await Model.findByPk(candidateId);
    while (current && current.parent_id) {
      if (current.parent_id === nodeId) return true;
      current = await Model.findByPk(current.parent_id);
    }
    return false;
  }
}
