import { Service } from 'egg';
import { Op } from 'sequelize';
import moment from 'moment';
import { renderTemplate } from '../lib/templateRenderer';

export interface SnippetCreatePayload {
  categoryId: number;
  code: string;
  title: string;
  content: string;
  tags?: string | null;
  sampleVariables?: Record<string, any> | null;
  description?: string | null;
}

export interface SnippetUpdatePayload {
  categoryId?: number;
  title?: string;
  content?: string;
  tags?: string | null;
  sampleVariables?: Record<string, any> | null;
  description?: string | null;
}

export interface SnippetListQuery {
  page?: number;
  pageSize?: number;
  categoryId?: number;
  status?: 0 | 1 | 2;
  tag?: string;
  keyword?: string;
}

export interface RenderInput {
  /** 自定义变量（覆盖内置同名） */
  variables?: Record<string, any>;
  /** 关联的反馈 ID，用于自动注入内置变量 */
  feedbackId?: number;
  /** 当前操作管理员 ID（用于注入 adminName） */
  adminId?: number;
}

const MAX_CONTENT_LEN = 5000;
const MIN_PUBLISH_LEN = 10;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 20;
const MAX_IMPORT_BATCH = 500;

/**
 * 反馈话术 Service
 * - 草稿/发布/停用 状态机
 * - 版本快照 + 回滚
 * - 变量渲染（复用 templateRenderer）
 * - 智能推荐（4 因子加权）
 * - 使用记录 + 统计
 * - JSON 导入导出
 */
export default class FeedbackSnippetService extends Service {
  // ============================================================
  // 一、CRUD
  // ============================================================

  async list(query: SnippetListQuery, accessibleCategoryIds?: number[] | null) {
    const where: any = {};
    if (query.categoryId !== undefined) where.category_id = query.categoryId;
    if (query.status !== undefined) where.status = query.status;
    if (query.tag) where.tags = { [Op.like]: `%${query.tag}%` };
    if (query.keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${query.keyword}%` } },
        { content: { [Op.like]: `%${query.keyword}%` } },
        { code: { [Op.like]: `%${query.keyword}%` } },
      ];
    }
    if (accessibleCategoryIds && accessibleCategoryIds.length > 0) {
      where.category_id = where.category_id
        ? where.category_id
        : { [Op.in]: accessibleCategoryIds };
    }

    const Model = this.ctx.model.FeedbackSnippet as any;
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);

    const { count, rows } = await Model.findAndCountAll({
      where,
      order: [['updated_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      list: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    };
  }

  async detail(id: number) {
    const row = await (this.ctx.model.FeedbackSnippet as any).findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');
    return row;
  }

  async create(payload: SnippetCreatePayload, operatorId: number) {
    this._validateContent(payload.content);
    this._validateTags(payload.tags);

    const Model = this.ctx.model.FeedbackSnippet as any;
    const CatModel = this.ctx.model.FeedbackSnippetCategory as any;

    const cat = await CatModel.findByPk(payload.categoryId);
    if (!cat) this.ctx.throw(422, '分类不存在');

    const dup = await Model.findOne({ where: { code: payload.code } });
    if (dup) this.ctx.throw(409, `话术 code "${payload.code}" 已存在`);

    return Model.create({
      category_id: payload.categoryId,
      code: payload.code,
      title: payload.title,
      content: payload.content,
      tags: payload.tags || null,
      sample_variables: payload.sampleVariables || null,
      current_version: 0,
      status: 0, // 草稿
      usage_count: 0,
      description: payload.description || null,
      created_by: operatorId,
      updated_by: operatorId,
    });
  }

  /**
   * 编辑话术 — 仅草稿（status=0）可直接改；已发布（status=1）只能改"非内容"字段
   */
  async update(id: number, payload: SnippetUpdatePayload, operatorId: number) {
    const Model = this.ctx.model.FeedbackSnippet as any;
    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');

    if (payload.content !== undefined) this._validateContent(payload.content);
    if (payload.tags !== undefined) this._validateTags(payload.tags);

    if (row.status === 1 && (payload.title !== undefined || payload.content !== undefined)) {
      this.ctx.throw(422, '已发布话术不能直接修改 title/content，请先发布新版本');
    }

    if (payload.categoryId) {
      const CatModel = this.ctx.model.FeedbackSnippetCategory as any;
      const cat = await CatModel.findByPk(payload.categoryId);
      if (!cat) this.ctx.throw(422, '分类不存在');
    }

    const updates: any = { updated_by: operatorId };
    if (payload.categoryId !== undefined) updates.category_id = payload.categoryId;
    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.content !== undefined) updates.content = payload.content;
    if (payload.tags !== undefined) updates.tags = payload.tags;
    if (payload.sampleVariables !== undefined) updates.sample_variables = payload.sampleVariables;
    if (payload.description !== undefined) updates.description = payload.description;

    await row.update(updates);
    return row;
  }

  async destroy(id: number) {
    const Model = this.ctx.model.FeedbackSnippet as any;
    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');
    await row.destroy();
    return { id };
  }

  // ============================================================
  // 二、发布 / 回滚 / 停用
  // ============================================================

  /**
   * 发布当前内容为新版本（草稿 → 已发布）
   */
  async publish(id: number, changeNote: string | null, operatorId: number) {
    const Model = this.ctx.model.FeedbackSnippet as any;
    const VerModel = this.ctx.model.FeedbackSnippetVersion as any;
    const sequelize = (this.app as any).model;

    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');
    if (!row.title || !row.content || row.content.length < MIN_PUBLISH_LEN) {
      this.ctx.throw(422, `发布前 title/content 必填，且 content 长度 >= ${MIN_PUBLISH_LEN}`);
    }

    const t = await sequelize.transaction();
    try {
      const newVersion = (row.current_version || 0) + 1;

      await VerModel.create({
        snippet_id: id,
        version: newVersion,
        title: row.title,
        content: row.content,
        tags: row.tags,
        sample_variables: row.sample_variables,
        change_note: changeNote || null,
        published_by: operatorId,
        published_at: new Date(),
      }, { transaction: t });

      await row.update({
        current_version: newVersion,
        status: 1,
        updated_by: operatorId,
      }, { transaction: t });

      await t.commit();
      return { id, version: newVersion };
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  async disable(id: number, operatorId: number) {
    const Model = this.ctx.model.FeedbackSnippet as any;
    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');
    await row.update({ status: 2, updated_by: operatorId });
    return { id };
  }

  /**
   * 回滚到指定版本（恢复 title/content/tags/sample_variables，并新增一个版本快照）
   */
  async rollback(id: number, versionId: number, operatorId: number) {
    const Model = this.ctx.model.FeedbackSnippet as any;
    const VerModel = this.ctx.model.FeedbackSnippetVersion as any;
    const sequelize = (this.app as any).model;

    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');

    const target = await VerModel.findOne({ where: { id: versionId, snippet_id: id } });
    if (!target) this.ctx.throw(404, '版本不存在或不属于当前话术');

    const t = await sequelize.transaction();
    try {
      const newVersion = (row.current_version || 0) + 1;

      await VerModel.create({
        snippet_id: id,
        version: newVersion,
        title: target.title,
        content: target.content,
        tags: target.tags,
        sample_variables: target.sample_variables,
        change_note: `回滚到 v${target.version}`,
        published_by: operatorId,
        published_at: new Date(),
      }, { transaction: t });

      await row.update({
        title: target.title,
        content: target.content,
        tags: target.tags,
        sample_variables: target.sample_variables,
        current_version: newVersion,
        status: 1,
        updated_by: operatorId,
      }, { transaction: t });

      await t.commit();
      return { id, version: newVersion };
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  async listVersions(id: number) {
    const VerModel = this.ctx.model.FeedbackSnippetVersion as any;
    return VerModel.findAll({
      where: { snippet_id: id },
      order: [['version', 'DESC']],
    });
  }

  // ============================================================
  // 三、渲染 / 推荐 / 使用
  // ============================================================

  /**
   * 渲染话术（注入内置变量 + 自定义变量）
   */
  async render(id: number, input: RenderInput) {
    const Model = this.ctx.model.FeedbackSnippet as any;
    const row = await Model.findByPk(id);
    if (!row) this.ctx.throw(404, '话术不存在');

    const builtIn = await this._buildBuiltinVariables(input);
    const variables = { ...builtIn, ...(input.variables || {}) };

    const result = renderTemplate(row.content, variables, { escape: 'none' });
    return {
      id,
      title: row.title,
      content: result.result,
      missingVars: result.missingVars,
      builtinVariables: Object.keys(builtIn),
    };
  }

  /**
   * 智能推荐（按反馈内容匹配）
   * - 因子: 反馈类型匹配(0.4) + 标签命中(0.4) + 全局热度(0.15) + 个人偏好(0.05)
   */
  async recommend(feedbackId: number, currentUserId: number, accessibleCategoryIds: number[]) {
    const FeedbackModel = this.ctx.model.Feedback as any;
    const SnipModel = this.ctx.model.FeedbackSnippet as any;
    const CatModel = this.ctx.model.FeedbackSnippetCategory as any;

    const fb = await FeedbackModel.findByPk(feedbackId);
    if (!fb) this.ctx.throw(404, '反馈不存在');

    if (accessibleCategoryIds.length === 0) {
      return { list: [] };
    }

    // 先按 feedback.type 找分类
    const matchedCats = await CatModel.findAll({
      where: {
        id: { [Op.in]: accessibleCategoryIds },
        status: 1,
        feedback_type: fb.type,
      },
      attributes: ['id'],
    });
    const matchedCatIds = matchedCats.map((c: any) => c.id);

    // 候选话术：已发布 + 在用户可访问分类内
    const candidates = await SnipModel.findAll({
      where: {
        status: 1,
        category_id: { [Op.in]: accessibleCategoryIds },
      },
      limit: 100, // 上限，避免大表全量
    });

    if (candidates.length === 0) return { list: [] };

    const maxUsage = Math.max(...candidates.map((c: any) => c.usage_count || 0), 1);

    // 简单关键词提取：按中英文标点切，过滤长度<2
    const keywords = this._extractKeywords(fb.content || '');

    // 个人偏好：30天内当前用户用过的 snippet ID
    const sequelize = (this.app as any).model;
    const [recentRows] = await sequelize.query(
      `SELECT DISTINCT snippet_id FROM feedback_snippet_usage_logs
        WHERE user_id = ? AND created_at >= ?`,
      { replacements: [currentUserId, moment().subtract(30, 'days').toDate()] },
    );
    const recentSet = new Set<number>((recentRows as any[]).map(r => r.snippet_id));

    // 评分
    const scored: Array<{ snippet: any; score: number }> = candidates.map((c: any) => {
      const typeMatch = matchedCatIds.includes(c.category_id) ? 1 : 0;

      let tagHit = 0;
      if (c.tags && keywords.length > 0) {
        const tagStr = String(c.tags).toLowerCase();
        const titleStr = String(c.title || '').toLowerCase();
        let hits = 0;
        keywords.forEach(k => {
          if (tagStr.includes(k) || titleStr.includes(k)) hits++;
        });
        tagHit = Math.min(hits * 0.5, 1);
      }

      const usageNorm = (c.usage_count || 0) / maxUsage;
      const personal = recentSet.has(c.id) ? 1 : 0;

      const score = 0.4 * typeMatch + 0.4 * tagHit + 0.15 * usageNorm + 0.05 * personal;
      return { snippet: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 10).filter((s) => s.score > 0);

    return {
      list: top.map((s) => ({
        id: s.snippet.id,
        categoryId: s.snippet.category_id,
        code: s.snippet.code,
        title: s.snippet.title,
        content: s.snippet.content,
        tags: s.snippet.tags,
        usageCount: s.snippet.usage_count,
        score: Number(s.score.toFixed(3)),
      })),
    };
  }

  /**
   * 当前用户可见的全部话术（按分类分组）—— picker 接口
   */
  async picker(accessibleCategoryIds: number[]) {
    if (accessibleCategoryIds.length === 0) return { categories: [], snippets: [] };

    const CatModel = this.ctx.model.FeedbackSnippetCategory as any;
    const SnipModel = this.ctx.model.FeedbackSnippet as any;

    const categories = await CatModel.findAll({
      where: { id: { [Op.in]: accessibleCategoryIds }, status: 1 },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });

    const snippets = await SnipModel.findAll({
      where: {
        status: 1,
        category_id: { [Op.in]: accessibleCategoryIds },
      },
      attributes: ['id', 'category_id', 'code', 'title', 'content', 'tags', 'usage_count'],
      order: [['usage_count', 'DESC']],
    });

    return { categories, snippets };
  }

  /**
   * 记录一次使用
   */
  async recordUsage(snippetId: number, feedbackId: number, userId: number, finalContent?: string | null) {
    const SnipModel = this.ctx.model.FeedbackSnippet as any;
    const LogModel = this.ctx.model.FeedbackSnippetUsageLog as any;
    const sequelize = (this.app as any).model;

    const snip = await SnipModel.findByPk(snippetId);
    if (!snip) return; // 静默忽略，不影响主流程

    const t = await sequelize.transaction();
    try {
      await LogModel.create({
        snippet_id: snippetId,
        feedback_id: feedbackId,
        user_id: userId,
        final_content: finalContent || null,
        feedback_status_after: 2, // reply 后 feedback.status 必为 2 已回复
      }, { transaction: t });

      await snip.update({
        usage_count: (snip.usage_count || 0) + 1,
        last_used_at: new Date(),
      }, { transaction: t });

      await t.commit();
    } catch (e) {
      await t.rollback();
      // 不抛出，记录失败不影响业务
      this.ctx.logger.error('[snippet:recordUsage] failed:', e);
    }
  }

  /**
   * 反馈状态变更回调 — 在 feedback.update() 把 status 改为 3 时调用
   * 把该反馈相关的 usage_logs.feedback_status_after 同步为 3
   */
  async syncFeedbackStatus(feedbackId: number, newStatus: number) {
    const sequelize = (this.app as any).model;
    if (newStatus === 3) {
      await sequelize.query(
        `UPDATE feedback_snippet_usage_logs
           SET feedback_status_after = 3
           WHERE feedback_id = ? AND feedback_status_after < 3`,
        { replacements: [feedbackId] },
      );
    } else if (newStatus < 3) {
      // 回滚（如管理员把反馈从已关闭改回处理中）
      await sequelize.query(
        `UPDATE feedback_snippet_usage_logs
           SET feedback_status_after = 2
           WHERE feedback_id = ? AND feedback_status_after = 3`,
        { replacements: [feedbackId] },
      );
    }
  }

  // ============================================================
  // 四、统计
  // ============================================================

  /**
   * 热门话术 Top N（含关闭率）
   */
  async statsTop(limit = 10) {
    const sequelize = (this.app as any).model;
    const [rows] = await sequelize.query(
      `SELECT
         s.id, s.code, s.title, s.usage_count,
         c.name AS category_name,
         COUNT(l.id) AS log_count,
         SUM(CASE WHEN l.feedback_status_after = 3 THEN 1 ELSE 0 END) AS closed_count
       FROM feedback_snippets s
       LEFT JOIN feedback_snippet_categories c ON s.category_id = c.id
       LEFT JOIN feedback_snippet_usage_logs l ON l.snippet_id = s.id
       WHERE s.deleted_at IS NULL
       GROUP BY s.id, s.code, s.title, s.usage_count, c.name
       ORDER BY s.usage_count DESC
       LIMIT ?`,
      { replacements: [limit] },
    );

    return (rows as any[]).map(r => ({
      id: r.id,
      code: r.code,
      title: r.title,
      categoryName: r.category_name,
      usageCount: r.usage_count,
      logCount: Number(r.log_count || 0),
      closedCount: Number(r.closed_count || 0),
      closeRate: r.log_count > 0 ? Number((r.closed_count / r.log_count).toFixed(3)) : 0,
    }));
  }

  /**
   * 概览统计
   */
  async statsOverview() {
    const SnipModel = this.ctx.model.FeedbackSnippet as any;
    const sequelize = (this.app as any).model;

    const totalSnippets = await SnipModel.count();
    const activeSnippets = await SnipModel.count({ where: { status: 1 } });

    const monthStart = moment().startOf('month').toDate();
    const [usageRows] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM feedback_snippet_usage_logs WHERE created_at >= ?`,
      { replacements: [monthStart] },
    );
    const monthUsage = Number((usageRows as any[])[0]?.cnt || 0);

    const [closeRows] = await sequelize.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN feedback_status_after = 3 THEN 1 ELSE 0 END) AS closed
       FROM feedback_snippet_usage_logs`,
    );
    const closeRow = (closeRows as any[])[0] || {};
    const avgCloseRate = closeRow.total > 0
      ? Number((closeRow.closed / closeRow.total).toFixed(3))
      : 0;

    return {
      totalSnippets,
      activeSnippets,
      monthUsage,
      avgCloseRate,
    };
  }

  /**
   * 使用趋势（按日）
   */
  async statsTrend(days = 30) {
    const sequelize = (this.app as any).model;
    const start = moment().subtract(days - 1, 'days').startOf('day').toDate();

    const [rows] = await sequelize.query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*) AS usage_count,
         COUNT(DISTINCT snippet_id) AS active_snippets
       FROM feedback_snippet_usage_logs
       WHERE created_at >= ?
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { replacements: [start] },
    );

    // 补齐缺失日期
    const map = new Map<string, any>();
    (rows as any[]).forEach(r => {
      const d = moment(r.date).format('YYYY-MM-DD');
      map.set(d, { date: d, usageCount: Number(r.usage_count), activeSnippets: Number(r.active_snippets) });
    });

    const result: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = moment().subtract(days - 1 - i, 'days').format('YYYY-MM-DD');
      result.push(map.get(d) || { date: d, usageCount: 0, activeSnippets: 0 });
    }
    return result;
  }

  // ============================================================
  // 五、导入 / 导出
  // ============================================================

  async exportAll() {
    const CatModel = this.ctx.model.FeedbackSnippetCategory as any;
    const SnipModel = this.ctx.model.FeedbackSnippet as any;

    const categories = await CatModel.findAll({
      attributes: [
        'code', 'name', 'description', 'feedback_type',
        'icon', 'color', 'sort_order', 'status', 'is_system', 'parent_id',
      ],
      order: [['sort_order', 'ASC']],
    });

    // 把 parent_id 转 parent_code 以便迁移
    const catIdToCode = new Map<number, string>();
    categories.forEach((c: any) => catIdToCode.set(c.id, c.code));

    const snippets = await SnipModel.findAll({
      where: { status: { [Op.in]: [0, 1] } },
      attributes: [
        'code', 'category_id', 'title', 'content', 'tags',
        'sample_variables', 'description', 'status',
      ],
      order: [['code', 'ASC']],
    });

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      categories: categories.map((c: any) => ({
        code: c.code,
        parentCode: c.parent_id ? catIdToCode.get(c.parent_id) || null : null,
        name: c.name,
        description: c.description,
        feedbackType: c.feedback_type,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sort_order,
        status: c.status,
        isSystem: c.is_system,
      })),
      snippets: snippets.map((s: any) => ({
        code: s.code,
        categoryCode: catIdToCode.get(s.category_id) || null,
        title: s.title,
        content: s.content,
        tags: s.tags,
        sampleVariables: s.sample_variables,
        description: s.description,
        status: s.status,
      })),
    };
  }

  /**
   * 导入（按 code 幂等：已存在则跳过）
   */
  async importData(data: any, operatorId: number) {
    if (!data || typeof data !== 'object') this.ctx.throw(422, '数据格式错误');
    const cats = Array.isArray(data.categories) ? data.categories : [];
    const snips = Array.isArray(data.snippets) ? data.snippets : [];

    if (snips.length > MAX_IMPORT_BATCH) {
      this.ctx.throw(422, `单次导入话术不可超过 ${MAX_IMPORT_BATCH} 条`);
    }

    const CatModel = this.ctx.model.FeedbackSnippetCategory as any;
    const SnipModel = this.ctx.model.FeedbackSnippet as any;
    const sequelize = (this.app as any).model;

    let categoriesCreated = 0;
    let snippetsCreated = 0;
    const skipped: string[] = [];

    const t = await sequelize.transaction();
    try {
      // 第一遍：建无父分类的
      const codeToId = new Map<string, number>();
      const existCats = await CatModel.findAll({ attributes: ['id', 'code'], transaction: t });
      existCats.forEach((c: any) => codeToId.set(c.code, c.id));

      for (const c of cats) {
        if (!c.code || codeToId.has(c.code)) {
          if (codeToId.has(c.code)) skipped.push(`category:${c.code}`);
          continue;
        }
        const created = await CatModel.create({
          code: c.code,
          parent_id: null, // 第二遍补
          name: c.name || c.code,
          description: c.description || null,
          feedback_type: c.feedbackType || null,
          icon: c.icon || null,
          color: c.color || null,
          sort_order: c.sortOrder ?? 0,
          status: c.status ?? 1,
          is_system: 0,
          created_by: operatorId,
          updated_by: operatorId,
        }, { transaction: t });
        codeToId.set(c.code, created.id);
        categoriesCreated++;
      }

      // 第二遍：补 parent_id
      for (const c of cats) {
        if (c.parentCode && codeToId.has(c.code)) {
          const childId = codeToId.get(c.code)!;
          const parentId = codeToId.get(c.parentCode);
          if (parentId) {
            await CatModel.update(
              { parent_id: parentId },
              { where: { id: childId }, transaction: t },
            );
          }
        }
      }

      // 话术
      for (const s of snips) {
        if (!s.code) continue;
        const dup = await SnipModel.findOne({ where: { code: s.code }, transaction: t });
        if (dup) {
          skipped.push(`snippet:${s.code}`);
          continue;
        }
        const catId = codeToId.get(s.categoryCode);
        if (!catId) {
          skipped.push(`snippet:${s.code}(分类不存在:${s.categoryCode})`);
          continue;
        }
        if (!s.content || s.content.length > MAX_CONTENT_LEN) {
          skipped.push(`snippet:${s.code}(content 长度非法)`);
          continue;
        }
        await SnipModel.create({
          category_id: catId,
          code: s.code,
          title: s.title || s.code,
          content: s.content,
          tags: s.tags || null,
          sample_variables: s.sampleVariables || null,
          current_version: 0,
          status: 0, // 导入后默认草稿
          usage_count: 0,
          description: s.description || null,
          created_by: operatorId,
          updated_by: operatorId,
        }, { transaction: t });
        snippetsCreated++;
      }

      await t.commit();
      return { categoriesCreated, snippetsCreated, skipped };
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  // ============================================================
  // 私有辅助
  // ============================================================

  private _validateContent(content: string) {
    if (!content || typeof content !== 'string') {
      this.ctx.throw(422, 'content 必填');
    }
    if (content.length > MAX_CONTENT_LEN) {
      this.ctx.throw(422, `content 长度不可超过 ${MAX_CONTENT_LEN}`);
    }
  }

  private _validateTags(tags?: string | null) {
    if (!tags) return;
    const arr = String(tags).split('|').filter(t => t.trim());
    if (arr.length > MAX_TAGS) {
      this.ctx.throw(422, `tags 数量不可超过 ${MAX_TAGS}`);
    }
    for (const t of arr) {
      if (t.length > MAX_TAG_LEN) {
        this.ctx.throw(422, `单个 tag 长度不可超过 ${MAX_TAG_LEN}`);
      }
    }
  }

  /**
   * 提取关键词（简单切分，无外部分词库）
   */
  private _extractKeywords(text: string): string[] {
    const stopwords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'and', 'or', 'to', 'of',
    ]);
    return String(text)
      .toLowerCase()
      .split(/[\s,，。.;；:：!！?？、""''()（）【】\[\]{}/\\|]+/)
      .filter(t => t.length >= 2 && !stopwords.has(t))
      .slice(0, 10);
  }

  /**
   * 构建内置变量
   */
  private async _buildBuiltinVariables(input: RenderInput): Promise<Record<string, string>> {
    const vars: Record<string, string> = {
      currentDate: moment().format('YYYY-MM-DD'),
    };

    if (input.feedbackId) {
      const fb = await (this.ctx.model.Feedback as any).findByPk(input.feedbackId);
      if (fb) {
        vars.feedbackId = String(fb.id);
        vars.feedbackType = this._typeText(fb.type);
        if (fb.user_id) {
          const user = await (this.ctx.model.User as any).findByPk(fb.user_id, {
            attributes: ['username', 'nickname'],
          });
          if (user) vars.userName = user.nickname || user.username || '用户';
        }
      }
    }

    if (input.adminId) {
      const admin = await (this.ctx.model.User as any).findByPk(input.adminId, {
        attributes: ['username', 'nickname'],
      });
      if (admin) vars.adminName = admin.nickname || admin.username || '管理员';
    }

    return vars;
  }

  private _typeText(type: string): string {
    return ({
      bug: 'Bug',
      suggestion: '建议',
      praise: '表扬',
      other: '其他',
    } as any)[type] || type;
  }
}
