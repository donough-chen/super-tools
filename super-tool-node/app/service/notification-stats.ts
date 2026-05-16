import { Service } from 'egg';

const CACHE = new Map<string, { at: number; data: any }>();

interface Range { from: Date; to: Date; }

export default class NotificationStatsService extends Service {

  async overview(input: Range) {
    this._guardRange(input);
    return this._cached(`ov:${this._key(input)}`, async () => {
      const sql = `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='sent' OR status='delivered' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN is_read=1 THEN 1 ELSE 0 END) AS \`read\`
      FROM notification_messages WHERE created_at BETWEEN ? AND ?`;
      const skipSql = `SELECT COUNT(*) AS skipped FROM notification_send_logs
        WHERE status='skipped' AND created_at BETWEEN ? AND ?`;
      const [[m]] = await this.ctx.model.query(sql,
        { replacements: [input.from, input.to] }) as any;
      const [[s]] = await this.ctx.model.query(skipSql,
        { replacements: [input.from, input.to] }) as any;
      const total = Number(m.total ?? 0);
      const read = Number(m.read ?? 0);
      return {
        total,
        sent: Number(m.sent ?? 0),
        delivered: Number(m.delivered ?? 0),
        failed: Number(m.failed ?? 0),
        skipped: Number(s.skipped ?? 0),
        readRate: total === 0 ? 0 : Number((read / total).toFixed(4)),
      };
    });
  }

  async trend(input: Range & { granularity: 'day' | 'hour' }) {
    this._guardRange(input);
    return this._cached(`tr:${input.granularity}:${this._key(input)}`, async () => {
      const fmt = input.granularity === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d';
      const sql = `SELECT DATE_FORMAT(created_at, ?) AS ts,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered
      FROM notification_messages
      WHERE created_at BETWEEN ? AND ?
      GROUP BY ts ORDER BY ts ASC`;
      const [rows] = await this.ctx.model.query(sql,
        { replacements: [fmt, input.from, input.to] }) as any;
      return rows.map((r: any) => ({
        ts: r.ts, total: Number(r.total),
        sent: Number(r.sent), delivered: Number(r.delivered),
      }));
    });
  }

  async byChannel(input: Range) {
    this._guardRange(input);
    return this._cached(`bc:${this._key(input)}`, async () => {
      const sql = `SELECT channel,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS fail
      FROM notification_messages
      WHERE created_at BETWEEN ? AND ? GROUP BY channel`;
      const [rows] = await this.ctx.model.query(sql,
        { replacements: [input.from, input.to] }) as any;
      return rows.map((r: any) => ({
        channel: r.channel, total: Number(r.total),
        success: Number(r.success), fail: Number(r.fail),
      }));
    });
  }

  async byType(input: Range & { limit: number }) {
    this._guardRange(input);
    return this._cached(`bt:${input.limit}:${this._key(input)}`, async () => {
      const sql = `SELECT t.code AS typeKey, t.name,
        COUNT(*) AS total,
        SUM(CASE WHEN m.status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent
      FROM notification_messages m
      JOIN notification_types t ON t.id = m.type_id
      WHERE m.created_at BETWEEN ? AND ?
      GROUP BY t.id ORDER BY total DESC LIMIT ?`;
      const [rows] = await this.ctx.model.query(sql,
        { replacements: [input.from, input.to, input.limit] }) as any;
      return rows.map((r: any) => ({
        typeKey: r.typeKey, name: r.name,
        total: Number(r.total), sent: Number(r.sent),
      }));
    });
  }

  async funnel(input: Range & { typeKey?: string }) {
    this._guardRange(input);
    return this._cached(`fn:${input.typeKey ?? 'all'}:${this._key(input)}`, async () => {
      const typeFilter = input.typeKey
        ? 'AND type_id = (SELECT id FROM notification_types WHERE code = ?)'
        : '';
      const sql = `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('pending','sent','delivered') THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN is_read=1 THEN 1 ELSE 0 END) AS \`read\`
      FROM notification_messages
      WHERE created_at BETWEEN ? AND ? ${typeFilter}`;
      const replacements: any[] = [input.from, input.to];
      if (input.typeKey) replacements.push(input.typeKey);
      const [[r]] = await this.ctx.model.query(sql, { replacements }) as any;
      return {
        total: Number(r.total), queued: Number(r.queued),
        sent: Number(r.sent), delivered: Number(r.delivered),
        read: Number(r.read),
      };
    });
  }

  /** 清空内存缓存（供 admin 手动刷新按钮使用） */
  invalidateCache() { CACHE.clear(); }

  private _guardRange(input: Range) {
    const days = (input.to.getTime() - input.from.getTime()) / 86400_000;
    const maxDays = (this.app.config as any).notification?.stats?.maxRangeDays ?? 90;
    if (days > maxDays) {
      this.ctx.throw(400, '统计时间范围超过 90 天');
    }
  }

  private _key(input: Range) {
    return `${input.from.toISOString()}_${input.to.toISOString()}`;
  }

  private async _cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const ttl = (this.app.config as any).notification?.stats?.cacheMs ?? 300_000;
    const c = CACHE.get(key);
    if (c && Date.now() - c.at < ttl) return c.data;
    const data = await fn();
    CACHE.set(key, { at: Date.now(), data });
    return data;
  }
}
