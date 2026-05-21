import { Service } from 'egg';
import { Op } from 'sequelize';
import moment from 'moment';

export interface FeedbackCreatePayload {
  userId?: number | null;
  type: 'bug' | 'suggestion' | 'praise' | 'other';
  content: string;
  contact?: string | null;
  platform?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface FeedbackListQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: 0 | 1 | 2 | 3;
  platform?: string;
  userId?: number;
  keyword?: string;
  startTime?: string;
  endTime?: string;
}

export interface FeedbackMyListQuery {
  page?: number;
  pageSize?: number;
  status?: 0 | 1 | 2 | 3;
}

const STATUS_LABELS: Record<number, string> = {
  0: '待处理', 1: '处理中', 2: '已回复', 3: '已关闭',
};

export default class FeedbackService extends Service {
  /**
   * 创建反馈（C 端 / 管理端共用）
   * - status 默认 0（待处理）
   * - 各字段允许 null（匿名用户场景）
   * - 登录用户提交后 → 通知管理员（admin 角色）
   */
  async create(payload: FeedbackCreatePayload) {
    const fb = await this.ctx.model.Feedback.create({
      userId: payload.userId ?? null,
      type: payload.type,
      content: payload.content,
      contact: payload.contact ?? null,
      platform: payload.platform ?? null,
      ip: payload.ip ?? null,
      userAgent: payload.userAgent ?? null,
      status: 0,
    });

    // 触发通知：新反馈提交 → 通知管理员（含 super_admin/admin/operator）
    if (payload.userId) {
      try {
        const adminIds = await this._getAdminUserIds();
        if (adminIds.length > 0) {
          await this.ctx.service.notification.core.sendByAudience({
            typeCode: 'BUSINESS_FEEDBACK_NEW',
            audienceType: 'static',
            staticUserIds: adminIds,
            variables: {
              feedbackType: payload.type,
              contentPreview: (payload.content || '').slice(0, 50),
            },
          });
        }
      } catch (e: any) {
        this.ctx.logger.warn(`[feedback.create] admin notification failed: ${e.message}`);
      }
    }

    return fb;
  }

  /**
   * 分页列表（管理端）
   * - 自动过滤软删（paranoid:true）
   * - 7 维过滤：type / status / platform / userId / keyword(content LIKE) / startTime / endTime
   * - LEFT JOIN user（匿名条目也要返回，user 字段 = null）
   */
  async list(q: FeedbackListQuery) {
    const where: any = {};
    if (q.type) where.type = q.type;
    if (q.status !== undefined) where.status = q.status;
    if (q.platform) where.platform = q.platform;
    if (q.userId) where.userId = q.userId;
    if (q.keyword) where.content = { [Op.like]: `%${q.keyword}%` };
    if (q.startTime || q.endTime) {
      where.createdAt = {};
      if (q.startTime) where.createdAt[Op.gte] = new Date(q.startTime);
      if (q.endTime)   where.createdAt[Op.lte] = new Date(q.endTime);
    }

    const page = Math.max(1, q.page || 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize || 20));

    const { count, rows } = await this.ctx.model.Feedback.findAndCountAll({
      where,
      include: [{
        association: 'user',
        attributes: ['id', 'username', 'nickname'],
        required: false,
      }],
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return { total: count, page, pageSize, rows };
  }

  /** 单条详情（含 user + replier） */
  async detail(id: number) {
    return this.ctx.model.Feedback.findByPk(id, {
      include: [
        { association: 'user',    attributes: ['id', 'username', 'nickname'], required: false },
        { association: 'replier', attributes: ['id', 'username', 'nickname'], required: false },
      ],
    });
  }

  /**
   * 用户端：我的反馈列表
   * - 仅返回当前用户的反馈
   * - 内容截断前 100 字
   */
  async myList(userId: number, q: FeedbackMyListQuery) {
    const where: any = { userId };
    if (q.status !== undefined) where.status = q.status;

    const page = Math.max(1, q.page || 1);
    const pageSize = Math.min(50, Math.max(1, q.pageSize || 20));

    const { count, rows } = await this.ctx.model.Feedback.findAndCountAll({
      where,
      attributes: ['id', 'type', 'content', 'status', 'createdAt', 'repliedAt'],
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return {
      total: count,
      page,
      pageSize,
      rows: rows.map((r: any) => {
        const json = r.toJSON();
        if (json.content && json.content.length > 100) {
          json.content = json.content.slice(0, 100) + '...';
        }
        return json;
      }),
    };
  }

  /**
   * 用户端：我的反馈详情
   * - 校验 userId 归属，防止越权访问
   */
  async myDetail(id: number, userId: number) {
    const fb = await this.ctx.model.Feedback.findOne({
      where: { id, userId },
      attributes: [
        'id', 'type', 'content', 'contact', 'platform', 'status',
        'replyContent', 'repliedAt', 'createdAt', 'updatedAt',
      ],
    });
    if (!fb) this.ctx.throw(404, 'feedback not found');
    return fb;
  }

  /**
   * 回复反馈 — 严格状态机 0/1 → 2
   * - 其他状态（2/3）抛 409
   * - 写入 reply_content / reply_user_id / replied_at 三字段
   */
  async reply(id: number, replyContent: string, replyUserId: number) {
    const fb = await this.ctx.model.Feedback.findByPk(id);
    if (!fb) this.ctx.throw(404, 'feedback not found');

    const status = (fb as any).status;
    if (status !== 0 && status !== 1) {
      this.ctx.throw(409,
        `反馈当前状态不允许回复（status=${status}），请先重新打开`);
    }

    await fb.update({
      status: 2,
      replyContent,
      replyUserId,
      repliedAt: new Date(),
    });

    // 触发通知：反馈回复
    try {
      if ((fb as any).userId) {
        await this.ctx.service.notification.core.send({
          typeCode: 'BUSINESS_FEEDBACK_REPLY',
          userId: (fb as any).userId,
          variables: {
            feedbackTitle: ((fb as any).content || '').slice(0, 20) || '反馈',
            replyContent: replyContent.slice(0, 200),
            repliedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
          },
          extra: { feedbackId: id },
        });
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[feedback.reply] notification failed: ${e.message}`);
    }

    return fb;
  }

  /**
   * 更新状态（重新打开 / 标为处理中 / 直接关闭）
   * - 受 transition 白名单约束
   * - 不允许通过此方法做 0/1→2（reply 独占）
   * - 状态变更时通知用户（仅当 userId 不为 null 且实际发生变化）
   */
  async update(id: number, payload: { status?: 0 | 1 | 2 | 3 }) {
    const fb = await this.ctx.model.Feedback.findByPk(id);
    if (!fb) this.ctx.throw(404, 'feedback not found');

    if (payload.status !== undefined) {
      if (![0, 1, 2, 3].includes(payload.status)) {
        this.ctx.throw(422, `invalid status: ${payload.status}`);
      }
      const fromStatus = (fb as any).status;
      const allowed = this._isStatusTransitionAllowed(fromStatus, payload.status);
      if (!allowed) {
        this.ctx.throw(422,
          `不允许的状态转移：${fromStatus} → ${payload.status}`);
      }
      await fb.update({ status: payload.status });

      // 触发通知：状态变更（仅当状态实际改变 & 反馈有归属用户）
      if (fromStatus !== payload.status && (fb as any).userId) {
        try {
          await this.ctx.service.notification.core.send({
            typeCode: 'BUSINESS_FEEDBACK_STATUS',
            userId: (fb as any).userId,
            variables: {
              feedbackTitle: ((fb as any).content || '').slice(0, 20) || '反馈',
              newStatus: STATUS_LABELS[payload.status] || String(payload.status),
              updateAt: moment().format('YYYY-MM-DD HH:mm:ss'),
            },
            extra: { feedbackId: id },
          });
        } catch (e: any) {
          this.ctx.logger.warn(`[feedback.update] notification failed: ${e.message}`);
        }
      }
    }
    return fb;
  }

  /**
   * 状态转移白名单
   * - 幂等允许（from === to）
   * - 0/1 → 2 仅由 reply() 独占（此处禁止）
   */
  private _isStatusTransitionAllowed(from: number, to: number): boolean {
    if (from === to) return true;
    const TRANSITIONS: Record<number, number[]> = {
      0: [1, 3],     // 待处理 → 处理中 / 直接关闭
      1: [0, 3],     // 处理中 → 取消 / 关闭
      2: [1],        // 已回复 → 重新打开
      3: [1],        // 已关闭 → 重新打开
    };
    return (TRANSITIONS[from] || []).includes(to);
  }

  /**
   * 软删（paranoid:true 自动 UPDATE deleted_at = NOW()）
   */
  async destroy(id: number) {
    const fb = await this.ctx.model.Feedback.findByPk(id);
    if (!fb) this.ctx.throw(404, 'feedback not found');
    await fb.destroy();
  }

  /**
   * 管理端：反馈统计概览
   * - 各状态计数 + 今日新增 + 平均回复时长 + 按类型分布
   */
  async statsOverview() {
    const { Feedback } = this.ctx.model;
    const Sequelize = (this.app as any).Sequelize;
    const { fn, col, literal } = Sequelize;

    // 各状态计数
    const statusCounts = await Feedback.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }) as any[];

    const statusMap: Record<number, number> = {};
    statusCounts.forEach((r: any) => { statusMap[r.status] = Number(r.count); });

    // 今日新增
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayNew = await Feedback.count({
      where: { createdAt: { [Op.gte]: todayStart } },
    });

    // 按类型分布
    const typeCounts = await Feedback.findAll({
      attributes: ['type', [fn('COUNT', col('id')), 'count']],
      group: ['type'],
      raw: true,
    }) as any[];
    const byType: Record<string, number> = { bug: 0, suggestion: 0, praise: 0, other: 0 };
    typeCounts.forEach((r: any) => { byType[r.type] = Number(r.count); });

    // 平均回复时长（小时）— 仅统计已回复的
    const avgResult = await Feedback.findOne({
      attributes: [
        [fn('AVG', literal('TIMESTAMPDIFF(SECOND, created_at, replied_at)')), 'avgSeconds'],
      ],
      where: { status: 2, repliedAt: { [Op.ne]: null } },
      raw: true,
    }) as any;
    const avgSeconds = avgResult?.avgSeconds ? Number(avgResult.avgSeconds) : 0;
    const avgReplyHours = avgSeconds ? Math.round((avgSeconds / 3600) * 10) / 10 : 0;

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

    return {
      total,
      pending: statusMap[0] || 0,
      processing: statusMap[1] || 0,
      replied: statusMap[2] || 0,
      closed: statusMap[3] || 0,
      todayNew,
      avgReplyHours,
      byType,
    };
  }

  /**
   * 管理端：反馈趋势数据
   * - 按日聚合提交/回复/关闭数
   * - days 范围限制 7~90（默认 30）
   */
  async statsTrend(days: number = 30) {
    days = Math.min(90, Math.max(7, days || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const Sequelize = (this.app as any).Sequelize;
    const { fn, col } = Sequelize;
    const { Feedback } = this.ctx.model;

    // 按日聚合提交数
    const submitted = await Feedback.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: startDate } },
      group: [fn('DATE', col('created_at'))],
      raw: true,
    }) as any[];

    // 按日聚合回复数
    const replied = await Feedback.findAll({
      attributes: [
        [fn('DATE', col('replied_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { repliedAt: { [Op.gte]: startDate, [Op.ne]: null } },
      group: [fn('DATE', col('replied_at'))],
      raw: true,
    }) as any[];

    // 按日聚合关闭数（status=3 且 updated_at 在范围内）
    const closed = await Feedback.findAll({
      attributes: [
        [fn('DATE', col('updated_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: {
        status: 3,
        updatedAt: { [Op.gte]: startDate },
      },
      group: [fn('DATE', col('updated_at'))],
      raw: true,
    }) as any[];

    // 统一日期 key（YYYY-MM-DD 字符串）
    const toKey = (d: any): string => {
      if (typeof d === 'string') return d.slice(0, 10);
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    };

    const submittedMap = new Map<string, number>(
      submitted.map((r: any) => [toKey(r.date), Number(r.count)]),
    );
    const repliedMap = new Map<string, number>(
      replied.map((r: any) => [toKey(r.date), Number(r.count)]),
    );
    const closedMap = new Map<string, number>(
      closed.map((r: any) => [toKey(r.date), Number(r.count)]),
    );

    // 补齐缺失日期
    const items: Array<{ date: string; submitted: number; replied: number; closed: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      items.push({
        date: dateStr,
        submitted: submittedMap.get(dateStr) || 0,
        replied: repliedMap.get(dateStr) || 0,
        closed: closedMap.get(dateStr) || 0,
      });
    }

    return { items };
  }

  /**
   * 管理端：待处理反馈计数（用于 badge）
   */
  async pendingCount() {
    const count = await this.ctx.model.Feedback.count({ where: { status: 0 } });
    return { count };
  }

  /**
   * 私有：获取所有管理角色用户 ID（admin/operator）
   * - 用于新反馈通知的接收者
   * - 通过原始 SQL JOIN 查询
   */
  private async _getAdminUserIds(): Promise<number[]> {
    const sql = `
      SELECT DISTINCT u.id AS id
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.status = 1
        AND u.deleted_at IS NULL
        AND r.code IN ('super_admin', 'admin', 'operator')
    `;
    const rows: any[] = await (this.app as any).model.query(sql, {
      type: 'SELECT',
    });
    return rows.map((r: any) => Number(r.id)).filter(id => id > 0);
  }
}
