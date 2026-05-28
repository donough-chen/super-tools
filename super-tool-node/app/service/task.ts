import BaseService from './base';
import {
  localTodayStr,
  localYearMonthStr,
  localYearStr,
  localIsoWeekStr,
} from '../lib/dateUtil';

/**
 * 周期键计算（统一走 Asia/Shanghai 本地时区，A2 修复 server 时区漂移）
 *  - once: 'once'
 *  - daily: 'YYYY-MM-DD'
 *  - weekly: 'YYYY-Www'（ISO 周；ISO 周年与日历年可能跨年差 1）
 *  - monthly: 'YYYY-MM'
 *  - yearly: 'YYYY'
 */
function cycleKey(cycle: string, d: Date = new Date()): string {
  switch (cycle) {
    case 'once': return 'once';
    case 'daily': return localTodayStr(d);
    case 'weekly': return localIsoWeekStr(d);
    case 'monthly': return localYearMonthStr(d);
    case 'yearly': return localYearStr(d);
    default: return 'once';
  }
}

/**
 * 任务中心服务
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 7
 *
 *  核心方法：
 *   - onEvent(evt)        事件分发入口（被 EventService.emit + messenger 双触发，靠 user_tasks 唯一索引幂等）
 *   - listUserTasks(...)  C 端任务列表
 *   - claim(...)          领奖（应用任务加成 + 检查日上限 + 写 completion log + 入账积分）
 *   - expireNewbieTasks() 新手任务过期清理（定时任务用）
 *
 *  进度类型（progress_type）：
 *   1 计数累加        progress = progress + 1
 *   2 去重计数        progressMeta.distinctSet 添加去重 key，progress = set.size
 *   3 累计阈值        progress = progress + payload.amount
 *   4 直接覆盖        progress = max(progress, payload.streak)
 *     - 用于连续签到任务：当 streak ≥ progressTarget 时立即 completed；
 *       此后即使收到更大 streak 的事件，也因 status='completed' 直接 return（无副作用，幂等）。
 *       例：achieve_sign_30 的 progress 可能停在 8（streak=8 时记录的最大值），后续 streak=9..29 的事件不再覆盖；
 *           只要 streak 永远不达 30，任务就维持 pending；一旦达成则 completed 永久锁定。
 */
export default class TaskService extends BaseService {
  /**
   * 事件入口（幂等：唯一索引 user_id+task_code+cycle_key + 事务锁）
   */
  async onEvent(evt: { code: string; userId: number; payload?: any }) {
    if (!evt || !evt.code || !evt.userId) return;
    const tasks: any[] = await this.ctx.model.Task.findAll({
      where: { triggerEvent: evt.code, status: 1 },
      order: [['sort', 'ASC']],
    });
    for (const task of tasks) {
      try {
        await this.applyEventToTask(task, evt);
      } catch (err: any) {
        this.ctx.logger.error(`[task:${task.code}] apply error: ${err.message}`, err);
      }
    }
  }

  /** 单个任务应用事件 */
  private async applyEventToTask(task: any, evt: any) {
    // ====== 条件过滤（task.condition 中的字段约束）======
    const cond = task.condition || {};

    // distinct_field 校验：去重计数任务必须 payload 中带去重值
    if (task.progressType === 2) {
      const distinctField = cond.distinct_field || 'tool_code';
      const v = evt.payload?.[distinctField];
      if (v === undefined || v === null || v === '') return;
    }

    // 累计阈值任务必须 payload 中带 amount
    if (task.progressType === 3) {
      const amt = Number(evt.payload?.amount || 0);
      if (amt <= 0) return;
    }

    // 直接覆盖任务（连续签到）必须 payload 中带 streak
    if (task.progressType === 4) {
      const s = Number(evt.payload?.streak || 0);
      if (s <= 0) return;
      // 当任务 progressTarget 是固定门槛（如 7/30/365），仅当 streak ≥ target 才"达成"，
      // 但我们仍然要先把 progress 推到 max，使 listUserTasks 能展示进度
    }

    // 通用条件过滤（如 condition.tool_code='json_format'，要求 payload.tool_code 匹配）
    for (const k of Object.keys(cond)) {
      if (k === 'amount' || k === 'streak' || k === 'distinct_field') continue;
      const expected = cond[k];
      const actual = evt.payload?.[k];
      if (Array.isArray(expected) ? !expected.includes(actual) : expected !== actual) return;
    }

    // 等级门槛（非常用，多数任务无）
    if (task.requiredLevel) {
      const m: any = await this.ctx.model.UserMember.findOne({ where: { userId: evt.userId } });
      if (!m || m.levelCode !== task.requiredLevel) return;
    }

    const ck = cycleKey(task.resetCycle);

    return await (this.ctx.model as any).transaction(async (t: any) => {
      const [ut, _created] = await (this.ctx.model.UserTask as any).findOrCreate({
        where: { userId: evt.userId, taskCode: task.code, cycleKey: ck },
        defaults: {
          userId: evt.userId,
          taskCode: task.code,
          cycleKey: ck,
          progress: 0,
          status: 'pending',
          progressMeta: task.progressType === 2 ? { distinctSet: [] } : null,
          expireAt: task.expireDays
            ? new Date(Date.now() + task.expireDays * 86_400_000)
            : null,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      // 已完成/已领奖/已过期 → 不再累进度（幂等）
      if (ut.status === 'completed' || ut.status === 'claimed' || ut.status === 'expired') return;

      let newProgress = ut.progress;
      let newMeta = ut.progressMeta || null;
      switch (task.progressType) {
        case 1:
          newProgress = ut.progress + 1;
          break;
        case 2: {
          const distinctField = cond.distinct_field || 'tool_code';
          const set = new Set<string>(newMeta?.distinctSet || []);
          const val = String(evt.payload?.[distinctField] ?? '');
          if (val) set.add(val);
          newMeta = { distinctSet: [...set] };
          newProgress = set.size;
          break;
        }
        case 3:
          newProgress = ut.progress + Number(evt.payload?.amount || 0);
          break;
        case 4:
          newProgress = Math.max(ut.progress, Number(evt.payload?.streak || 0));
          break;
      }

      const completed = newProgress >= task.progressTarget;
      await ut.update(
        {
          progress: newProgress,
          progressMeta: newMeta,
          status: completed ? 'completed' : 'pending',
          completedAt: completed ? new Date() : null,
        },
        { transaction: t },
      );

      if (completed) {
        // 写 completion log（pending → 等待用户 claim 才发奖；userTaskId 唯一索引保幂等）
        await (this.ctx.model.TaskCompletionLog as any).findOrCreate({
          where: { userTaskId: ut.id },
          defaults: {
            userTaskId: ut.id,
            userId: ut.userId,
            taskCode: ut.taskCode,
            cycleKey: ut.cycleKey,
            rewardPoints: 0,
            rewardGrowth: 0,
            bonusRate: 1.0,
            status: 'pending',
          },
          transaction: t,
        });
        // 通知（不阻塞主流程）
        try {
          await (this.ctx.service.notification as any).core.send({
            typeCode: 'BUSINESS_TASK_COMPLETED',
            userId: ut.userId,
            variables: { taskName: task.name, rewardPoints: task.rewardPoints },
          });
        } catch { /* ignore */ }
      }
    });
  }

  /** 用户领奖 */
  async claim(userId: number, taskCode: string) {
    return await (this.ctx.model as any).transaction(async (t: any) => {
      const task: any = await this.ctx.model.Task.findOne({
        where: { code: taskCode, status: 1 },
      });
      if (!task) this.ctx.throw(404, '任务不存在');

      const ck = cycleKey(task.resetCycle);
      const ut: any = await this.ctx.model.UserTask.findOne({
        where: { userId, taskCode, cycleKey: ck },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!ut) this.ctx.throw(400, '任务尚未达成');
      if (ut.status === 'claimed') this.ctx.throw(400, '已领取');
      if (ut.status !== 'completed') this.ctx.throw(400, '任务未完成');

      // ====== B4: 过期校验（spec §2.3-#9）======
      // expireAt 不为空且已过期 → 拒绝领奖（防止过期后仍发奖）
      if (ut.expireAt && new Date(ut.expireAt).getTime() < Date.now()) {
        this.ctx.throw(400, '任务已过期，无法领奖');
      }

      // ====== 检查每日上限（task / invite 两种维度，spec §2.3-#10）======
      if (task.dailyCapGroup === 'task') {
        const today = localTodayStr();
        const cap: any = await this.ctx.model.DailyPointsCap.findOne({
          where: { userId, capDate: today, capGroup: 'task' },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        const taskCapLimit = await this.getTaskDailyCap();
        if (cap && cap.earned >= taskCapLimit) {
          this.ctx.throw(400, '今日任务积分已达上限');
        }
      } else if (task.dailyCapGroup === 'invite') {
        // invite 类按 count 维度限频（每日最多 N 次邀请奖励）
        const today = localTodayStr();
        const cap: any = await this.ctx.model.DailyPointsCap.findOne({
          where: { userId, capDate: today, capGroup: 'invite' },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        const inviteCapLimit = await this.getInviteDailyCap();
        if (cap && cap.count >= inviteCapLimit) {
          this.ctx.throw(400, '今日邀请奖励次数已达上限');
        }
      }

      // ====== 应用任务加成 ======
      const member: any = await this.ctx.model.UserMember.findOne({
        where: { userId }, transaction: t,
      });
      if (!member) this.ctx.throw(404, '会员记录不存在');
      const rule = await this.ctx.service.pointsRule.getLevelRule(member.levelId);
      const realPoints = this.ctx.service.pointsRule.applyTaskBonus(task.rewardPoints, rule);

      // ====== 写 completion log（已存在则更新）======
      const [comp] = await (this.ctx.model.TaskCompletionLog as any).findOrCreate({
        where: { userTaskId: ut.id },
        defaults: {
          userTaskId: ut.id, userId, taskCode, cycleKey: ck,
          rewardPoints: realPoints,
          rewardGrowth: task.rewardGrowth,
          bonusRate: 1 + rule.taskBonusRate,
          status: 'pending',
        },
        transaction: t,
      });
      await comp.update(
        {
          rewardPoints: realPoints,
          rewardGrowth: task.rewardGrowth,
          bonusRate: 1 + rule.taskBonusRate,
        },
        { transaction: t },
      );

      // ====== 入账积分（按 v2 单对象签名调 addPoints）======
      const result: any = await this.ctx.service.member.addPoints({
        userId,
        points: realPoints,
        growthDelta: task.rewardGrowth,
        source: 'task_reward',
        event: 'task_reward',
        bizType: 'task',
        bizId: taskCode,
        remark: `任务奖励：${task.name}`,
        applyMultiplier: false,    // 任务奖励不再叠加等级倍率（已用 taskBonus）
        transaction: t,
      });

      // ====== 更新 completion log 与 user_task 状态 ======
      await comp.update(
        { status: 'rewarded', pointsLogId: result.logId },
        { transaction: t },
      );
      await ut.update(
        { status: 'claimed', claimedAt: new Date() },
        { transaction: t },
      );

      // ====== 累计每日上限计数（task / invite 两种维度）======
      if (task.dailyCapGroup === 'task' || task.dailyCapGroup === 'invite') {
        const today = localTodayStr();
        const grp = task.dailyCapGroup;
        const [cap, created] = await (this.ctx.model.DailyPointsCap as any).findOrCreate({
          where: { userId, capDate: today, capGroup: grp },
          defaults: { userId, capDate: today, capGroup: grp, earned: realPoints, count: 1 },
          transaction: t,
        });
        if (!created) {
          await cap.update(
            { earned: cap.earned + realPoints, count: cap.count + 1 },
            { transaction: t },
          );
        }
      }

      return {
        points: realPoints,
        growth: task.rewardGrowth,
        bonusRate: 1 + rule.taskBonusRate,
      };
    });
  }

  /**
   * 列出用户任务（spec §2.3-#11：分页 + 等级门槛过滤 + status 过滤）
   *  返回 { list, total, page, pageSize } 标准分页结构
   */
  async listUserTasks(
    userId: number,
    filter: {
      category?: string;
      status?: 'pending' | 'completed' | 'claimed' | 'expired' | 'all';
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ list: any[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(filter.pageSize) || 20), 100);

    const where: any = { status: 1 };
    if (filter.category) where.category = filter.category;

    // 1) 等级字典：建 code → level 数值 Map（用 MemberLevel.level 数值字段比较）
    const levels: any[] = await this.ctx.model.MemberLevel.findAll();
    const levelDict = new Map<string, number>();
    for (const lv of levels) levelDict.set(lv.code, Number(lv.level));

    // 当前用户等级数值（拿不到默认 0，requiredLevel 任务一律不可见）
    const member: any = await this.ctx.model.UserMember.findOne({ where: { userId } });
    const myLevelNum = member ? (levelDict.get(member.levelCode) || 0) : 0;

    // 2) 拉所有任务后做内存过滤（任务总量小，DB 等级比较成本高）
    const tasks: any[] = await this.ctx.model.Task.findAll({
      where,
      order: [['sort', 'ASC']],
    });
    const visibleTasks = tasks.filter(task => {
      if (!task.requiredLevel) return true; // 无门槛 → 全可见
      const required = levelDict.get(task.requiredLevel);
      if (required === undefined) return false; // requiredLevel 无效 → 隐藏（防脏数据）
      return myLevelNum >= required;
    });

    // 3) status 过滤：需要先查 user_task 状态，但放在分页前会让 total 不准；
    //    采用"先按任务表分页，再查每页 user_task 进度"（status 过滤在分页内做，total 是任务表的过滤前总数）
    //    取舍：如需 status 精准 total，可在此先全部装载 user_task；目前任务量不大，保持简单
    const total = visibleTasks.length;
    const paged = visibleTasks.slice((page - 1) * pageSize, page * pageSize);

    const list: any[] = [];
    for (const task of paged) {
      const ck = cycleKey(task.resetCycle);
      const ut: any = await this.ctx.model.UserTask.findOne({
        where: { userId, taskCode: task.code, cycleKey: ck },
      });
      // status 过滤（applied at page-level）
      if (filter.status && filter.status !== 'all') {
        const utStatus = ut?.status || 'pending';
        if (utStatus !== filter.status) continue;
      }
      list.push({
        code: task.code,
        name: task.name,
        icon: task.icon,
        description: task.description,
        category: task.category,
        progressTarget: task.progressTarget,
        rewardPoints: task.rewardPoints,
        rewardGrowth: task.rewardGrowth,
        progress: ut?.progress || 0,
        status: ut?.status || 'pending',
        expireAt: ut?.expireAt,
        requiredLevel: task.requiredLevel || null,
      });
    }
    return { list, total, page, pageSize };
  }

  /** 新手任务过期清理（schedule 调） */
  async expireNewbieTasks(): Promise<number> {
    const { Op } = require('sequelize');
    const now = new Date();
    const [count] = await (this.ctx.model.UserTask as any).update(
      { status: 'expired' },
      {
        where: {
          status: 'pending',
          expireAt: { [Op.lt]: now, [Op.ne]: null },
        },
      },
    );
    return count;
  }

  /** 读取 system_configs 中的任务类每日上限（兜底 50） */
  private async getTaskDailyCap(): Promise<number> {
    try {
      const rows: any[] = await (this.app.model as any).query(
        "SELECT `value` FROM `system_configs` WHERE `group`='points' AND `key`='daily_cap_task' LIMIT 1",
        { type: (this.app.model as any).QueryTypes.SELECT },
      );
      if (rows.length > 0 && rows[0].value) return Number(rows[0].value) || 50;
    } catch { /* ignore */ }
    return 50;
  }

  /** 读取 system_configs 中的邀请类每日次数上限（兜底 5） */
  private async getInviteDailyCap(): Promise<number> {
    try {
      const rows: any[] = await (this.app.model as any).query(
        "SELECT `value` FROM `system_configs` WHERE `group`='points' AND `key`='daily_cap_invite' LIMIT 1",
        { type: (this.app.model as any).QueryTypes.SELECT },
      );
      if (rows.length > 0 && rows[0].value) return Number(rows[0].value) || 5;
    } catch { /* ignore */ }
    return 5;
  }
}
