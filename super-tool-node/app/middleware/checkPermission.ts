import { Context } from 'egg';

/**
 * 权限检查中间件
 * 用法: checkPermission('user:list') 或 checkPermission(['user:list', 'user:create'])
 */
export default (requiredCodes: string | string[], _app: any) => {
  return async (ctx: Context, next: () => Promise<void>) => {
    const user = ctx.state.user;
    if (!user) {
      ctx.throw(401, '请先登录');
    }

    // 超级管理员跳过权限检查
    if (user.userType === 3) {
      return await next();
    }

    const codes = Array.isArray(requiredCodes) ? requiredCodes : [requiredCodes];
    const userCodes = await ctx.service.permission.getUserPermissionCodes(user.id);

    const hasPermission = codes.some(code => userCodes.includes(code));
    if (!hasPermission) {
      ctx.throw(403, '权限不足');
    }

    await next();
  };
};
