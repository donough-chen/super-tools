/**
 * @file 管理端 - 通知统计控制器
 * @description 提供通知系统的数据统计接口，包括概览、趋势、渠道分布、类型分布和发送漏斗。
 *              所有接口均需传入时间范围(from/to)，最大跨度 90 天。
 *              统计数据有 5 分钟内存缓存。
 * @module controller/admin/notification/stats
 */
import BaseController from '../../base';

export default class NotificationStatsController extends BaseController {
  /** 概览统计：总消息数、发送数、送达数、失败数、跳过数、阅读率 */
  async overview() {
    const { ctx } = this;
    const { from, to } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.overview({ from: new Date(String(from)), to: new Date(String(to)) }));
  }

  /** 趋势统计：按天/小时粒度的发送量时序数据 */
  async trend() {
    const { ctx } = this;
    const { from, to, granularity } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.trend({
      from: new Date(String(from)), to: new Date(String(to)), granularity: (granularity as any) || 'day',
    }));
  }

  /** 渠道分布：各渠道的发送总量、成功数、失败数 */
  async byChannel() {
    const { ctx } = this;
    const { from, to } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.byChannel({ from: new Date(String(from)), to: new Date(String(to)) }));
  }

  /** 类型分布：发送量 Top N 的通知类型 */
  async byType() {
    const { ctx } = this;
    const { from, to, limit } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.byType({
      from: new Date(String(from)), to: new Date(String(to)), limit: Number(limit) || 5,
    }));
  }

  /** 发送漏斗：total → queued → sent → delivered → read 各环节转化 */
  async funnel() {
    const { ctx } = this;
    const { from, to, typeKey } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.funnel({
      from: new Date(String(from)), to: new Date(String(to)), typeKey: typeKey as string | undefined,
    }));
  }
}
