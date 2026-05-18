import { Service } from 'egg';

const CACHE = new Map<string, { at: number; data: any }>();
interface Range { from: Date; to: Date; }

/**
 * 通知统计服务
 *
 * 表结构关键信息：
 * - notification_messages: id, user_id, type_id, channels(JSON), is_read, created_at  — 无 status / channel 列
 * - notification_send_logs: message_id, channel(VARCHAR), status(queued|sending|sent|delivered|failed|skipped), created_at
 */
export default class NotificationStatsService extends Service {

  async overview(input: Range) {
    this._guardRange(input);
    return this._cached(`ov:${this._key(input)}`, async () => {
      // 总消息数 & 已读数（来自 messages 表）
      const msgSql = `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS \`read\`
        FROM notification_messages WHERE created_at BETWEEN ? AND ?`;
      // 发送统计（来自 send_logs 表）
      const logSql = `SELECT
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped
        FROM notification_send_logs WHERE created_at BETWEEN ? AND ?`;
      const [[m]] = await this.ctx.model.query(msgSql, { replacements: [input.from, input.to] }) as any;
      const [[s]] = await this.ctx.model.query(logSql, { replacements: [input.from, input.to] }) as any;
      const total = Number(m.total ?? 0);
      const read = Number(m.read ?? 0);
      return {
        total,
        sent: Number(s.sent ?? 0),
        delivered: Number(s.delivered ?? 0),
        failed: Number(s.failed ?? 0),
        skipped: Number(s.skipped ?? 0),
        readRate: total === 0 ? 0 : Number((read / total).toFixed(4)),
      };
    });
  }

  async trend(input: Range & { granularity: 'day' | 'hour' }) {
    this._guardRange(input);
    return this._cached(`tr:${input.granularity}:${this._key(input)}`, async () => {
      const fmt = input.granularity === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d';
      // 基于 send_logs 统计趋势
      const sql = `SELECT DATE_FORMAT(created_at, ?) AS ts,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered
        FROM notification_send_logs
        WHERE created_at BETWEEN ? AND ?
        GROUP BY ts ORDER BY ts ASC`;
      const [rows] = await this.ctx.model.query(sql, { replacements: [fmt, input.from, input.to] }) as any;
      return rows.map((r: any) => ({ ts: r.ts, total: Number(r.total), sent: Number(r.sent), delivered: Number(r.delivered) }));
    });
  }

  async byChannel(input: Range) {
    this._guardRange(input);
    return this._cached(`bc:${this._key(input)}`, async () => {
      // send_logs 表有 channel 列
      const sql = `SELECT channel,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS fail
        FROM notification_send_logs
        WHERE created_at BETWEEN ? AND ?
        GROUP BY channel`;
      const [rows] = await this.ctx.model.query(sql, { replacements: [input.from, input.to] }) as any;
      return rows.map((r: any) => ({ channel: r.channel, total: Number(r.total), success: Number(r.success), fail: Number(r.fail) }));
    });
  }

  async byType(input: Range & { limit: number }) {
    this._guardRange(input);
    return this._cached(`bt:${input.limit}:${this._key(input)}`, async () => {
      // JOIN messages → types，统计来自 send_logs
      const sql = `SELECT t.code AS typeKey, t.name,
        COUNT(*) AS total,
        SUM(CASE WHEN l.status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent
        FROM notification_send_logs l
        JOIN notification_messages m ON m.id = l.message_id
        JOIN notification_types t ON t.id = m.type_id
        WHERE l.created_at BETWEEN ? AND ?
        GROUP BY t.id ORDER BY total DESC LIMIT ?`;
      const [rows] = await this.ctx.model.query(sql, { replacements: [input.from, input.to, input.limit] }) as any;
      return rows.map((r: any) => ({ typeKey: r.typeKey, name: r.name, total: Number(r.total), sent: Number(r.sent) }));
    });
  }

  async funnel(input: Range & { typeKey?: string }) {
    this._guardRange(input);
    return this._cached(`fn:${input.typeKey ?? 'all'}:${this._key(input)}`, async () => {
      // 漏斗：messages 表计 total + read，send_logs 表计 queued/sent/delivered
      const typeJoin = input.typeKey ? 'JOIN notification_types t ON t.id = m.type_id' : '';
      const typeFilter = input.typeKey ? 'AND t.code = ?' : '';

      const msgSql = `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN m.is_read = 1 THEN 1 ELSE 0 END) AS \`read\`
        FROM notification_messages m ${typeJoin}
        WHERE m.created_at BETWEEN ? AND ? ${typeFilter}`;
      const msgReplacements: any[] = [input.from, input.to];
      if (input.typeKey) msgReplacements.push(input.typeKey);

      const logTypeJoin = input.typeKey
        ? 'JOIN notification_messages m ON m.id = l.message_id JOIN notification_types t ON t.id = m.type_id'
        : '';
      const logTypeFilter = input.typeKey ? 'AND t.code = ?' : '';
      const logSql = `SELECT
        SUM(CASE WHEN l.status IN ('queued','sending','sent','delivered') THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN l.status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN l.status = 'delivered' THEN 1 ELSE 0 END) AS delivered
        FROM notification_send_logs l ${logTypeJoin}
        WHERE l.created_at BETWEEN ? AND ? ${logTypeFilter}`;
      const logReplacements: any[] = [input.from, input.to];
      if (input.typeKey) logReplacements.push(input.typeKey);

      const [[m]] = await this.ctx.model.query(msgSql, { replacements: msgReplacements }) as any;
      const [[l]] = await this.ctx.model.query(logSql, { replacements: logReplacements }) as any;
      return {
        total: Number(m.total ?? 0),
        queued: Number(l?.queued ?? 0),
        sent: Number(l?.sent ?? 0),
        delivered: Number(l?.delivered ?? 0),
        read: Number(m.read ?? 0),
      };
    });
  }

  invalidateCache() { CACHE.clear(); }

  private _guardRange(input: Range) {
    const days = (input.to.getTime() - input.from.getTime()) / 86400_000;
    if (days > ((this.app.config as any).notification?.stats?.maxRangeDays ?? 90)) this.ctx.throw(400, '统计时间范围超过 90 天');
  }
  private _key(input: Range) { return `${input.from.toISOString()}_${input.to.toISOString()}`; }
  private async _cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const ttl = (this.app.config as any).notification?.stats?.cacheMs ?? 300_000;
    const c = CACHE.get(key);
    if (c && Date.now() - c.at < ttl) return c.data;
    const data = await fn();
    CACHE.set(key, { at: Date.now(), data });
    return data;
  }
}
