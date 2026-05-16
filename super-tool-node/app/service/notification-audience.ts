import BaseService from './base';

/**
 * 受众解析服务
 *
 * P1 仅支持 all 和 static 两种受众类型。
 * dynamic 类型在 P2 由规则编译器实现。
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
   * 解析 static 类型受众：直接返回传入的 userId 列表
   */
  async resolveStatic(userIds: number[]): Promise<number[]> {
    return userIds.filter(id => typeof id === 'number' && id > 0);
  }

  /**
   * 统一入口：按 audienceType 分发
   */
  async resolve(input: {
    audienceType: 'all' | 'static' | 'dynamic';
    staticUserIds?: number[];
    dynamicRules?: any;
  }): Promise<number[]> {
    switch (input.audienceType) {
      case 'all':
        return this.resolveAll();
      case 'static':
        return this.resolveStatic(input.staticUserIds || []);
      case 'dynamic':
        this.ctx.throw(501, '动态受众解析能力将在 P2 提供');
        return []; // unreachable but satisfies TS
      default:
        this.ctx.throw(400, `不支持的受众类型: ${input.audienceType}`);
        return [];
    }
  }
}
