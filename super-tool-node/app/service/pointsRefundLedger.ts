import { Service } from 'egg';
import { QueryTypes } from 'sequelize';

/**
 * 退款账本 Service（B1 灰度·管理端）
 *
 *  设计依据:
 *    - docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.7
 *    - docs/superpowers/plans/2026-05-28-积分管理模块管理端实施计划.md §Task 13
 *    - 数据表: database/027_b1_refund_ledger.sql §1 (points_logs.metadata JSON)
 *    - Flag:   system_configs.refund.reverse_fifo
 *    - Model:  app/model/points_log.ts (含 metadata JSON 字段)
 *
 *  能力：
 *    1. list({ userId, originalLogId, page, pageSize })
 *         按 metadata.scenario='B1_REFUND' 查 points_logs 流水
 *    2. getFlag()
 *         读 system_configs.refund.reverse_fifo 当前灰度状态
 *
 *  实现备注：
 *    - metadata 是 JSON 列，使用 MySQL JSON_EXTRACT 函数走 raw query
 *      （Sequelize 跨方言 JSON path 能力较弱）。
 *    - getFlag 走 raw query 与 service/member.ts:608 行同款写法保持一致
 *      （仓库内 SystemConfig model 未注册，所有 system_configs 读取都走 raw）。
 */
export interface ListRefundLedgerParams {
  userId?: number;
  originalLogId?: number;
  page?: number;
  pageSize?: number;
}

export default class PointsRefundLedgerService extends Service {
  /**
   * 查询 B1 退款账本流水
   *  - 命中条件: points_logs.metadata->'$.scenario' = 'B1_REFUND'
   *  - 排序: created_at DESC
   *  - 分页: 默认 50 / 页, 上限 200
   */
  async list(params: ListRefundLedgerParams) {
    const { app } = this;
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));

    const whereClauses: string[] = [
      `JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.scenario')) = 'B1_REFUND'`,
    ];
    const replacements: any = {};
    if (params.userId) {
      whereClauses.push('user_id = :userId');
      replacements.userId = Number(params.userId);
    }
    if (params.originalLogId) {
      whereClauses.push(
        `JSON_EXTRACT(metadata, '$.originalLogId') = :originalLogId`,
      );
      replacements.originalLogId = Number(params.originalLogId);
    }
    const whereSql = whereClauses.join(' AND ');

    const countSql = `SELECT COUNT(*) AS cnt FROM points_logs WHERE ${whereSql}`;
    const listSql = `
      SELECT id, user_id AS userId, type, source, points, balance,
             biz_type AS bizType, biz_id AS bizId, remark,
             metadata, created_at AS createdAt
        FROM points_logs
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset
    `;

    const [countRow] = await app.model.query(countSql, {
      replacements,
      type: QueryTypes.SELECT,
    });
    const list = await app.model.query(listSql, {
      replacements: {
        ...replacements,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      type: QueryTypes.SELECT,
    });

    // 兼容 metadata 在 mysql 驱动下可能返回 string / object 两种形式
    const normalized = (list as any[]).map((r) => {
      let meta = r.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { /* keep raw string */ }
      }
      return { ...r, metadata: meta };
    });

    return {
      list: normalized,
      total: Number((countRow as any)?.cnt || 0),
      page,
      pageSize,
    };
  }

  /**
   * 读 B1 反向 FIFO 退款账本灰度状态
   *  - key:   system_configs.refund.reverse_fifo
   *  - true:  启用新逻辑（反向 FIFO 退款账本）
   *  - false: 沿用旧逻辑（仅原批次扣回 + 余下扣会员余额）
   *
   *  返回: { enabled: boolean, raw: string, exists: boolean }
   *  说明: 走 raw query（与 service/member.ts 同款写法），SystemConfig model 不存在。
   */
  async getFlag() {
    const { app } = this;
    const rows = await app.model.query(
      "SELECT `value` FROM `system_configs` WHERE `group`='refund' AND `key`='reverse_fifo' LIMIT 1",
      { type: QueryTypes.SELECT },
    );
    if (!rows || rows.length === 0) {
      return { enabled: false, raw: 'false', exists: false };
    }
    const raw = String((rows[0] as any).value);
    const enabled = raw === 'true' || raw === '1';
    return { enabled, raw, exists: true };
  }
}
