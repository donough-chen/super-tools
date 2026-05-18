import BaseService from '../base';
import { compileAudienceRule, type Group } from '../../lib/audienceRuleCompiler';
import { AUDIENCE_FIELDS } from '../../lib/audienceFieldWhitelist';

export default class NotificationAudienceService extends BaseService {

  async resolveAll(): Promise<number[]> {
    const rows = await this.ctx.model.User.findAll({ where: { status: 1 }, attributes: ['id'], raw: true });
    return rows.map((r: any) => r.id);
  }

  async resolveStatic(userIds: number[]): Promise<number[]> {
    return userIds.filter(id => typeof id === 'number' && id > 0);
  }

  async resolveDynamic(rules: Group): Promise<number[]> {
    const { where, params, joins } = compileAudienceRule(rules);
    const joinClauses = Array.from(joins).join(' ');
    const sql = `SELECT DISTINCT users.id FROM users ${joinClauses} WHERE users.status = 1 AND (${where})`;
    const rows: any[] = await this.app.model.query(sql, { replacements: params, type: 'SELECT' });
    return rows.map((r: any) => r.id);
  }

  async previewDynamic(rules: Group, limit: number = 100): Promise<{ userIds: number[]; total: number }> {
    const { where, params, joins } = compileAudienceRule(rules);
    const joinClauses = Array.from(joins).join(' ');
    const countSql = `SELECT COUNT(DISTINCT users.id) AS cnt FROM users ${joinClauses} WHERE users.status = 1 AND (${where})`;
    const countRows: any[] = await this.app.model.query(countSql, { replacements: params, type: 'SELECT' });
    const total = countRows[0]?.cnt || 0;
    const listSql = `SELECT DISTINCT users.id FROM users ${joinClauses} WHERE users.status = 1 AND (${where}) LIMIT ${limit}`;
    const listRows: any[] = await this.app.model.query(listSql, { replacements: params, type: 'SELECT' });
    return { userIds: listRows.map((r: any) => r.id), total };
  }

  async resolve(input: { audienceType: 'all' | 'static' | 'dynamic'; staticUserIds?: number[]; dynamicRules?: Group }): Promise<number[]> {
    switch (input.audienceType) {
      case 'all': return this.resolveAll();
      case 'static': return this.resolveStatic(input.staticUserIds || []);
      case 'dynamic':
        if (!input.dynamicRules) this.ctx.throw(400, '动态受众规则不能为空');
        return this.resolveDynamic(input.dynamicRules!);
      default:
        this.ctx.throw(400, `不支持的受众类型: ${input.audienceType}`);
        return [];
    }
  }

  getFieldWhitelist() {
    return Object.entries(AUDIENCE_FIELDS).map(([key, meta]) => ({
      field: key, type: meta.type, label: meta.label, ops: meta.ops,
    }));
  }
}
