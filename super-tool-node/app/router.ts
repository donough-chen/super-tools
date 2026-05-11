import { Application } from 'egg';

export default (app: Application) => {
  const { router, controller, middleware } = app;
  const auth = (middleware as any).auth({}, app);
  // 权限中间件工厂：checkPermission('code') 或 checkPermission(['code1','code2'])
  const perm = (code: string | string[]) => (middleware as any).checkPermission(code, app);

  // ==================== 认证 ====================
  router.post('/api/auth/login', controller.auth.login);
  router.post('/api/auth/register', controller.auth.register);
  router.post('/api/auth/refresh', controller.auth.refresh);
  router.post('/api/auth/send-code', controller.auth.sendCode);
  router.post('/api/auth/wechat-login', controller.auth.wechatLogin);
  router.post('/api/auth/phone-login', controller.auth.phoneLogin);
  router.get('/api/auth/wechat-auth-url', controller.auth.getWechatAuthUrl);
  router.post('/api/auth/logout', auth, controller.auth.logout);
  router.get('/api/auth/me', auth, controller.auth.me);
  router.get('/api/auth/sessions', auth, controller.auth.sessions);
  router.delete('/api/auth/sessions/:id', auth, controller.auth.kickSession);

  // ==================== 账号绑定 ====================
  router.post('/api/auth/bind/phone', auth, controller.auth.bindPhone);
  router.post('/api/auth/bind/wechat', auth, controller.auth.bindWechat);
  router.post('/api/auth/bind/email', auth, controller.auth.bindEmail);
  router.post('/api/auth/unbind', auth, controller.auth.unbind);
  router.get('/api/auth/bind-status', auth, controller.auth.bindStatus);

  // ==================== 用户（当前用户：自己操作自己，无需权限码） ====================
  router.get('/api/users/profile', auth, controller.user.profile);
  router.get('/api/users/profile/extra', auth, controller.user.profileExtra);
  router.put('/api/users/profile', auth, controller.user.updateProfile);
  router.put('/api/users/password', auth, controller.user.changePassword);
  router.get('/api/users/addresses', auth, controller.user.listAddresses);
  router.post('/api/users/addresses', auth, controller.user.addAddress);
  router.put('/api/users/addresses/:id', auth, controller.user.updateAddress);
  router.delete('/api/users/addresses/:id', auth, controller.user.deleteAddress);

  // ==================== 设备管理（当前用户自己的设备） ====================
  router.post('/api/users/devices', auth, controller.user.registerDevice);
  router.get('/api/users/devices', auth, controller.user.listDevices);
  router.delete('/api/users/devices/:deviceId', auth, controller.user.removeDevice);
  router.put('/api/users/devices/:deviceId/push', auth, controller.user.updatePushSettings);

  // ==================== 用户管理（管理端） ====================
  // 注意：这些路由挂在 /api/users 下，但语义是管理端 CRUD（参照 init.sql 权限码 path=/api/admin/users）
  router.get('/api/users', auth, perm('user:list'), controller.user.index);
  router.get('/api/users/:id', auth, perm('user:detail'), controller.user.show);
  router.post('/api/users', auth, perm('user:create'), controller.user.create);
  router.put('/api/users/:id', auth, perm('user:update'), controller.user.update);
  router.delete('/api/users/:id', auth, perm('user:delete'), controller.user.destroy);

  // ==================== 角色管理 ====================
  router.get('/api/admin/roles', auth, perm('system:role:list'), controller.admin.role.index);
  router.get('/api/admin/roles/:id', auth, perm('system:role:detail'), controller.admin.role.show);
  router.post('/api/admin/roles', auth, perm('system:role:create'), controller.admin.role.create);
  router.put('/api/admin/roles/:id', auth, perm('system:role:update'), controller.admin.role.update);
  router.delete('/api/admin/roles/:id', auth, perm('system:role:delete'), controller.admin.role.destroy);
  router.put('/api/admin/roles/:id/permissions', auth, perm('system:role:assign-permissions'), controller.admin.role.assignPermissions);

  // ==================== 权限管理 ====================
  router.get('/api/admin/permissions/tree', auth, perm('system:permission:tree'), controller.admin.permission.tree);
  router.get('/api/admin/permissions/modules', auth, perm('system:permission:tree'), controller.admin.permission.modules);
  router.get('/api/admin/permissions/:id', auth, perm('system:permission:list'), controller.admin.permission.show);
  // 以下 3 条为系统级写操作：当前 init.sql 未定义对应 code，暂复用 system:permission:list 占位
  // 生产上建议仅 super_admin 操作；super_admin 中间件短路，所以不会被挡
  router.post('/api/admin/permissions', auth, perm('system:permission:list'), controller.admin.permission.create);
  router.put('/api/admin/permissions/:id', auth, perm('system:permission:list'), controller.admin.permission.update);
  router.delete('/api/admin/permissions/:id', auth, perm('system:permission:list'), controller.admin.permission.destroy);

  // ==================== 管理端用户自查（菜单/权限码） ====================
  // 注意：仅挂 auth，不挂 perm —— 用户登录即可访问
  // 类型断言绕过 egg-ts-helper typings 滞后；运行时由 Egg 按文件系统加载，无问题
  const adminCtrl = controller.admin as any;
  router.get('/api/admin/auth/menus',       auth, adminCtrl.auth.menus);
  router.get('/api/admin/auth/permissions', auth, adminCtrl.auth.permissions);

  // ==================== 审计日志 ====================
  // 注意：export 路由必须放在 :id 之前，否则 /export 被 :id 吞掉
  router.get('/api/admin/audit-logs',
    auth, perm('system:audit-log:list'),
    adminCtrl.auditLog.list);
  router.get('/api/admin/audit-logs/export',
    auth, perm('system:audit-log:export'),
    adminCtrl.auditLog.exportCsv);
  router.get('/api/admin/audit-logs/:id',
    auth, perm('system:audit-log:detail'),
    adminCtrl.auditLog.detail);

  // ==================== 权限测试 ====================
  router.get('/api/admin/permissions/test',
    auth, perm('system:permission-test:run'),
    adminCtrl.permission.test);

  // ==================== 反馈（C 端） ====================
  // 可登录可不登录（controller 内手动解析 token）；限流 10 req/h/IP
  const userCtrl = controller as any;
  router.post('/api/feedback',
    app.middleware.rateLimit({ max: 10, window: 3600 }, app),
    userCtrl.feedback.create);

  // ==================== Dashboard ====================
  router.get('/api/admin/dashboard', auth, perm('dashboard:view'), controller.admin.dashboard.index);

  // ==================== 会员体系（C 端，用户自用） ====================
  router.get('/api/member/levels', controller.member.levels);
  router.get('/api/member/plans', controller.member.plans);
  router.get('/api/member/info', auth, controller.member.info);
  router.get('/api/member/benefits', auth, controller.member.benefits);
  router.get('/api/member/points-logs', auth, controller.member.pointsLogs);
  router.post('/api/member/daily-sign', auth, controller.member.dailySign);

  // ==================== 会员管理（管理端） ====================
  // 权限码定义见 database/007_add_member_module.sql；矩阵见 docs/architecture/RBAC.md § member
  router.get('/api/admin/member/levels', auth, perm('member:level:list'), controller.admin.member.levels);
  router.put('/api/admin/member/levels/:id', auth, perm('member:level:update'), controller.admin.member.updateLevel);
  router.get('/api/admin/member/plans', auth, perm('member:plan:list'), controller.admin.member.plans);
  router.put('/api/admin/member/plans/:id', auth, perm('member:plan:update'), controller.admin.member.updatePlan);
  router.get('/api/admin/member/users', auth, perm('member:user:list'), controller.admin.member.users);
  router.get('/api/admin/member/users/:id', auth, perm('member:user:list'), controller.admin.member.userDetail);
  router.post('/api/admin/member/users/:id/adjust-points', auth, perm('member:points:adjust'), controller.admin.member.adjustPoints);
  router.put('/api/admin/member/users/:id/level', auth, perm('member:level:assign'), controller.admin.member.adjustLevel);
  router.post('/api/admin/member/users/:id/activate-plan', auth, perm('member:plan:activate'), controller.admin.member.activatePlan);
  router.get('/api/admin/member/stats', auth, perm('member:stats:view'), controller.admin.member.stats);
  router.get('/api/admin/member/points-logs', auth, perm('member:points:log:view'), controller.admin.member.pointsLogs);

  // ==================== 工具（H5 端） ====================
  router.get('/api/tools/home', controller.tool.home);
  router.get('/api/tools/feature', controller.tool.featureList);
  router.get('/api/tools/member', controller.tool.memberList);
  router.get('/api/tools/:code/access', auth, controller.tool.checkAccess);

  // ==================== 工具分类管理（管理端） ====================
  router.get('/api/admin/tool-categories', auth, perm('category:list'), controller.admin.tool.listCategories);
  router.post('/api/admin/tool-categories', auth, perm('category:create'), controller.admin.tool.createCategory);
  router.put('/api/admin/tool-categories/:id', auth, perm('category:update'), controller.admin.tool.updateCategory);
  router.delete('/api/admin/tool-categories/:id', auth, perm('category:delete'), controller.admin.tool.deleteCategory);

  // ==================== 工具管理（管理端） ====================
  // 注意: batch-publish 必须放在 :id 路由之前，避免被 :id 参数捕获
  router.put('/api/admin/tools/batch-publish', auth, perm('tool:batch-update'), controller.admin.tool.batchPublish);
  router.get('/api/admin/tools', auth, perm('tool:list'), controller.admin.tool.listTools);
  router.get('/api/admin/tools/:id', auth, perm('tool:detail'), controller.admin.tool.showTool);
  router.post('/api/admin/tools', auth, perm('tool:create'), controller.admin.tool.createTool);
  router.put('/api/admin/tools/:id', auth, perm('tool:update'), controller.admin.tool.updateTool);
  router.delete('/api/admin/tools/:id', auth, perm('tool:delete'), controller.admin.tool.deleteTool);

  // ==================== 用户收藏工具（C 端自用，仅 auth） ====================
  // 注意: 精确路径（codes / reorder / check/:toolCode）必须放在 /:toolCode 之前
  router.get('/api/favorites/codes', auth, controller.favorite.codes);
  router.put('/api/favorites/reorder', auth, controller.favorite.reorder);
  router.get('/api/favorites/check/:toolCode', auth, controller.favorite.check);
  router.get('/api/favorites', auth, controller.favorite.index);
  router.post('/api/favorites', auth, controller.favorite.create);
  router.delete('/api/favorites/:toolCode', auth, controller.favorite.destroy);
};
