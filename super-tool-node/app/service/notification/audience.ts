/**
 * @file 受众解析服务
 * @description 负责将受众分组配置解析为具体的用户ID列表。
 *   - resolveAll(): 全量用户（status=1）
 *   - resolveStatic(): 静态ID列表过滤
 *   - resolveDynamic(): 动态规则编译为 SQL 并执行查询
 *   - previewDynamic(): 预览动态规则命中人数和样本
 *   - getFieldWhitelist(): 返回前端规则构建器可用的字段列表
 *
 * @module service/notification/audience
 */
import BaseService from '../base';
import { compileAudienceRule, type Group } from '../../lib/audienceRuleCompiler';
import { AUDIENCE_FIELDS } from '../../lib/audienceFieldWhitelist';

export default class NotificationAudienceService extends BaseService {

  /** 解析全量用户（仅状态正常的用户） */
  async resolveAll(): Promise<number[]> {
    const rows = await this.ctx.model.User.findAll({ where: { status: 1 }, attributes: ['id'], raw: true });
    return rows.map((r: any) => r.id);
  }

  /** 静态用户列表过滤（去除非法ID） */
  async resolveStatic(userIds: number[]): Promise<number[]> {
    return userIds.filter(id => typeof id === 'number' && id > 0);
  }

  /** 动态规则解析：将 JSON 规则编译为 SQL 并执行查询 */
  async resolveDynamic(rules: Group): Promise<number[]> {
    const { where, params, joins } = compileAudienceRule(rules);
    const joinClauses = Array.from(joins).join(' ');
    const sql = `SELECT DISTINCT users.id FROM users ${joinClauses} WHERE users.status = 1 AND (${where})`;
    const rows: any[] = await this.app.model.query(sql, { replacements: params, type: 'SELECT' });
    return rows.map((r: any) => r.id);
  }

  /** 预览动态规则命中结果：返回总数和样本用户ID（限制 limit 条） */
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

  /** 统一入口：根据 audienceType 调度对应的解析方法 */
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

  /** 返回前端规则构建器可用的字段白名单 */
  getFieldWhitelist() {
    return Object.entries(AUDIENCE_FIELDS).map(([key, meta]) => ({
      field: key, type: meta.type, label: meta.label, ops: meta.ops,
    }));
  }
}
