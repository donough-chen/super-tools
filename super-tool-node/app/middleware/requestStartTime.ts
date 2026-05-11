import { Context } from 'egg';

/**
 * 请求开始时间注入 middleware
 * - 在所有 middleware 链最前端挂载
 * - 用于 service.audit.log() 计算 cost_time
 */
export default () => {
  return async (ctx: Context, next: () => Promise<any>) => {
    (ctx.state as any).requestStartTime = Date.now();
    await next();
  };
};
