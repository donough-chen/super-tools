import { Service } from 'egg';
import { Op } from 'sequelize';

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

export default class FeedbackService extends Service {
  /**
   * 创建反馈（C 端 / 管理端共用）
   * - status 默认 0（待处理）
   * - 各字段允许 null（匿名用户场景）
   */
  async create(payload: FeedbackCreatePayload) {
    return this.ctx.model.Feedback.create({
      userId: payload.userId ?? null,
      type: payload.type,
      content: payload.content,
      contact: payload.contact ?? null,
      platform: payload.platform ?? null,
      ip: payload.ip ?? null,
      userAgent: payload.userAgent ?? null,
      status: 0,
    });
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
   * 回复反馈 — 严格状态机 0/1 → 2
   * - 其他状态（2/3）抛 409
   * - 写入 reply_content / reply_user_id / replied_at 三字段
   * - 注意：service 层做状态机检查是冗余防线（controller 不一定能拦住直调）
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
      await this.ctx.service.notification.send({
        typeCode: 'BUSINESS_FEEDBACK_REPLY',
        userId: (fb as any).userId,
        variables: {
          feedbackTitle: (fb as any).title || '反馈',
          replyContent: replyContent.slice(0, 200),
        },
        extra: { feedbackId: id },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[feedback.reply] notification failed: ${e.message}`);
    }

    return fb;
  }

  /**
   * 更新状态（重新打开 / 标为处理中 / 直接关闭）
   * - 受 transition 白名单约束
   * - 不允许通过此方法做 0/1→2（reply 独占）
   */
  async update(id: number, payload: { status?: 0 | 1 | 2 | 3 }) {
    const fb = await this.ctx.model.Feedback.findByPk(id);
    if (!fb) this.ctx.throw(404, 'feedback not found');

    if (payload.status !== undefined) {
      if (![0, 1, 2, 3].includes(payload.status)) {
        this.ctx.throw(422, `invalid status: ${payload.status}`);
      }
      const allowed = this._isStatusTransitionAllowed(
        (fb as any).status, payload.status,
      );
      if (!allowed) {
        this.ctx.throw(422,
          `不允许的状态转移：${(fb as any).status} → ${payload.status}`);
      }
      await fb.update({ status: payload.status });
    }
    return fb;
  }

  /**
   * 状态转移白名单
   * - 幂等允许（from === to）
   * - 0/1 → 2 仅由 reply() 独占（此处禁止）
   * - 2/3 禁止跳到 0/2/3（避免跳过"重新打开"语义）
   */
  private _isStatusTransitionAllowed(from: number, to: number): boolean {
    if (from === to) return true;   // 幂等
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
}
