import { Context } from 'egg';

export default (_options: any, _app: any) => {
  return async (ctx: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (err: any) {
      // 记录错误日志
      ctx.logger.error('[ErrorHandler]', err);

      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';

      // 区分不同错误类型
      if (status === 422) {
        ctx.body = {
          code: 422,
          message: '参数验证失败',
          errors: err.errors,
          timestamp: Date.now(),
        };
      } else if (status === 401) {
        ctx.body = {
          code: 401,
          message: '未授权，请先登录',
          timestamp: Date.now(),
        };
      } else if (status === 403) {
        ctx.body = {
          code: 403,
          message: '权限不足',
          timestamp: Date.now(),
        };
      } else if (status === 404) {
        ctx.body = {
          code: 404,
          message: '资源不存在',
          timestamp: Date.now(),
        };
      } else if (status === 429) {
        ctx.body = {
          code: 429,
          message: message || '请求过于频繁，请稍后再试',
          timestamp: Date.now(),
        };
      } else {
        ctx.body = {
          code: status,
          message:
            process.env.NODE_ENV === 'production'
              ? 'Internal Server Error'
              : message,
          errors: process.env.NODE_ENV !== 'production' ? (err.errors || err.original?.message || err.stack?.split('\n')[0]) : undefined,
          timestamp: Date.now(),
        };
      }

      ctx.status = status;
    }
  };
};
