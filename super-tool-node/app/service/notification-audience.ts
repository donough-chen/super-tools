import BaseService from './base';
import { compileAudienceRule, type Group } from '../lib/audienceRuleCompiler';
import { AUDIENCE_FIELDS } from '../lib/audienceFieldWhitelist';

/**
 * 受众解析服务
 *
 * P1: all + static
 * P2.3: + dynamic（JSON 规则编译为 SQL）
 */
export default class NotificationAudienceService extends BaseService {

  /**
   * 解析 all 类型受众：返回所有激活用户 ID
   */
  async resolveAll(): Promise<number[]> {
    const rows = await this.ctx.model.User.findAll({
      where: { status: 1 },
      attributes: ['id'],
      raw: true,
    });
    return rows.map((r: any) => r.id);
  }

  /**
   * 解析 static 类型受众
   */
  async resolveStatic(userIds: number[]): Promise<number[]> {
    return userIds.filter(id => typeof id === 'number' && id > 0);
  }

  /**
   * 解析 dynamic 类型受众：JSON 规则 → SQL → 用户列表
   */
  async resolveDynamic(rules: Group): Promise<number[]> {
    const { where, params, joins } = compileAudienceRule(rules);

    const joinClauses = Array.from(joins).join(' ');
    const sql = `SELECT DISTINCT users.id FROM users ${joinClauses} WHERE users.status = 1 AND (${where})`;

    const rows: any[] = await this.app.model.query(sql, {
      replacements: params,
      type: 'SELECT',
    });
    return rows.map((r: any) => r.id);
  }

  /**
   * 预览动态受众（返回前 limit 条 + 总数）
   */
  async previewDynamic(rules: Group, limit: number = 100): Promise<{ userIds: number[]; total: number }> {
    const { where, params, joins } = compileAudienceRule(rules);
    const joinClauses = Array.from(joins).join(' ');

    // 总数
    const countSql = `SELECT COUNT(DISTINCT users.id) AS cnt FROM users ${joinClauses} WHERE users.status = 1 AND (${where})`;
    const countRows: any[] = await this.app.model.query(countSql, {
      replacements: params,
      type: 'SELECT',
    });
    const total = countRows[0]?.cnt || 0;

    // 前 N 条
    const listSql = `SELECT DISTINCT users.id FROM users ${joinClauses} WHERE users.status = 1 AND (${where}) LIMIT ${limit}`;
    const listRows: any[] = await this.app.model.query(listSql, {
      replacements: params,
      type: 'SELECT',
    });
    const userIds = listRows.map((r: any) => r.id);

    return { userIds, total };
  }

  /**
   * 统一入口：按 audienceType 分发
   */
  async resolve(input: {
    audienceType: 'all' | 'static' | 'dynamic';
    staticUserIds?: number[];
    dynamicRules?: Group;
  }): Promise<number[]> {
    switch (input.audienceType) {
      case 'all':
        return this.resolveAll();
      case 'static':
        return this.resolveStatic(input.staticUserIds || []);
      case 'dynamic':
        if (!input.dynamicRules) {
          this.ctx.throw(400, '动态受众规则不能为空');
        }
        return this.resolveDynamic(input.dynamicRules!);
      default:
        this.ctx.throw(400, `不支持的受众类型: ${input.audienceType}`);
        return [];
    }
  }

  /**
   * 获取字段白名单元数据（供前端 RuleBuilder 使用）
   */
  getFieldWhitelist() {
    return Object.entries(AUDIENCE_FIELDS).map(([key, meta]) => ({
      field: key,
      type: meta.type,
      label: meta.label,
      ops: meta.ops,
    }));
  }
}
