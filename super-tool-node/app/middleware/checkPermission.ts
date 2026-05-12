import { Context } from 'egg';

/**
 * 权限检查中间件
 * 用法: checkPermission('user:list') 或 checkPermission(['user:list', 'user:create'])
 *
 * super_admin 判定统一走 RBAC（roles 表 code='super_admin'），
 * 不再依赖已废弃的 user_type 字段。
 */
export default (requiredCodes: string | string[], _app: any) => {
  return async (ctx: Context, next: () => Promise<void>) => {
    const user = ctx.state.user;
    if (!user) {
      ctx.throw(401, '请先登录');
    }

    // 超级管理员跳过权限检查（通过 RBAC 角色判定）
    const isSuperAdmin = await ctx.service.permission.isSuperAdmin(user.id);
    if (isSuperAdmin) {
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
