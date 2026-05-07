import { Context } from 'egg';

/**
 * SSO 认证中间件
 * 验证 JWT → 查 user_sessions 表确认会话有效
 */
export default (_options: any, app: any) => {
  return async (ctx: Context, next: () => Promise<void>) => {
    const whiteList = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/send-code',
      '/api/auth/wechat-login',
      '/api/auth/phone-login',
      '/api/auth/wechat-auth-url',
    ];

    if (whiteList.some((path) => ctx.path.startsWith(path))) {
      return await next();
    }

    const token = ctx.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      ctx.throw(401, '请提供认证Token');
    }

    try {
      // 1. 验证 JWT
      const decoded = app.jwt.verify(token, (app.config as any).jwt.secret) as any;

      // 2. 查 session 表确认会话有效
      const session = await ctx.model.UserSession.findOne({
        where: { accessToken: token, isActive: 1 },
      });

      if (!session) {
        ctx.throw(401, 'Token已失效，请重新登录');
      }

      const sessionData = (session as any).toJSON();
      if (new Date(sessionData.accessExpireAt) < new Date()) {
        ctx.throw(401, 'Token已过期，请刷新Token');
      }

      ctx.state.user = decoded;
      ctx.state.token = token;
      ctx.state.sessionId = sessionData.sessionId;

      await next();
    } catch (err: any) {
      if (err.status === 401) throw err;
      if (err.name === 'TokenExpiredError') {
        ctx.throw(401, 'Token已过期，请刷新Token');
      } else if (err.name === 'JsonWebTokenError') {
        ctx.throw(401, 'Token无效');
      }
      throw err;
    }
  };
};
