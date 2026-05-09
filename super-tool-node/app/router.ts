import { Application } from 'egg';

export default (app: Application) => {
  const { router, controller, middleware } = app;
  const auth = (middleware as any).auth({}, app);

  // ==================== 认证 ====================
  router.post('/api/auth/login', controller.auth.login);
  router.post('/api/auth/register', controller.auth.register);
  router.post('/api/auth/refresh', controller.auth.refresh);
  router.post('/api/auth/send-code', controller.auth.sendCode);
  router.post('/api/auth/wechat-login', controller.auth.wechatLogin);
  router.post('/api/auth/phone-login', controller.auth.phoneLogin);
  router.get('/api/auth/wechat-auth-url', controller.auth.getWechatAuthUrl);
  router.post('/api/auth/logout', auth, controller.auth.logout);
  router.get('/api/auth/sessions', auth, controller.auth.sessions);
  router.delete('/api/auth/sessions/:id', auth, controller.auth.kickSession);

  // ==================== 账号绑定 ====================
  router.post('/api/auth/bind/phone', auth, controller.auth.bindPhone);
  router.post('/api/auth/bind/wechat', auth, controller.auth.bindWechat);
  router.post('/api/auth/bind/email', auth, controller.auth.bindEmail);
  router.post('/api/auth/unbind', auth, controller.auth.unbind);
  router.get('/api/auth/bind-status', auth, controller.auth.bindStatus);

  // ==================== 用户（当前用户） ====================
  router.get('/api/users/profile', auth, controller.user.profile);
  router.get('/api/users/profile/extra', auth, controller.user.profileExtra);
  router.put('/api/users/profile', auth, controller.user.updateProfile);
  router.put('/api/users/password', auth, controller.user.changePassword);
  router.get('/api/users/addresses', auth, controller.user.listAddresses);
  router.post('/api/users/addresses', auth, controller.user.addAddress);
  router.put('/api/users/addresses/:id', auth, controller.user.updateAddress);
  router.delete('/api/users/addresses/:id', auth, controller.user.deleteAddress);

  // ==================== 设备管理 ====================
  router.post('/api/users/devices', auth, controller.user.registerDevice);
  router.get('/api/users/devices', auth, controller.user.listDevices);
  router.delete('/api/users/devices/:deviceId', auth, controller.user.removeDevice);
  router.put('/api/users/devices/:deviceId/push', auth, controller.user.updatePushSettings);

  // ==================== 用户管理（管理端） ====================
  router.get('/api/users', auth, controller.user.index);
  router.get('/api/users/:id', auth, controller.user.show);
  router.post('/api/users', auth, controller.user.create);
  router.put('/api/users/:id', auth, controller.user.update);
  router.delete('/api/users/:id', auth, controller.user.destroy);

  // ==================== 角色管理 ====================
  router.get('/api/admin/roles', auth, controller.admin.role.index);
  router.get('/api/admin/roles/:id', auth, controller.admin.role.show);
  router.post('/api/admin/roles', auth, controller.admin.role.create);
  router.put('/api/admin/roles/:id', auth, controller.admin.role.update);
  router.delete('/api/admin/roles/:id', auth, controller.admin.role.destroy);
  router.put('/api/admin/roles/:id/permissions', auth, controller.admin.role.assignPermissions);

  // ==================== 权限管理 ====================
  router.get('/api/admin/permissions/tree', auth, controller.admin.permission.tree);
  router.get('/api/admin/permissions/:id', auth, controller.admin.permission.show);
  router.post('/api/admin/permissions', auth, controller.admin.permission.create);
  router.put('/api/admin/permissions/:id', auth, controller.admin.permission.update);
  router.delete('/api/admin/permissions/:id', auth, controller.admin.permission.destroy);

  // ==================== Dashboard ====================
  router.get('/api/admin/dashboard', auth, controller.admin.dashboard.index);

  // ==================== 会员体系（C 端） ====================
  router.get('/api/member/levels', controller.member.levels);
  router.get('/api/member/plans', controller.member.plans);
  router.get('/api/member/info', auth, controller.member.info);
  router.get('/api/member/benefits', auth, controller.member.benefits);
  router.get('/api/member/points-logs', auth, controller.member.pointsLogs);
  router.post('/api/member/daily-sign', auth, controller.member.dailySign);

  // ==================== 会员管理（管理端） ====================
  router.get('/api/admin/member/levels', auth, controller.admin.member.levels);
  router.put('/api/admin/member/levels/:id', auth, controller.admin.member.updateLevel);
  router.get('/api/admin/member/plans', auth, controller.admin.member.plans);
  router.put('/api/admin/member/plans/:id', auth, controller.admin.member.updatePlan);
  router.get('/api/admin/member/users', auth, controller.admin.member.users);
  router.get('/api/admin/member/users/:id', auth, controller.admin.member.userDetail);
  router.post('/api/admin/member/users/:id/adjust-points', auth, controller.admin.member.adjustPoints);
  router.put('/api/admin/member/users/:id/level', auth, controller.admin.member.adjustLevel);
  router.post('/api/admin/member/users/:id/activate-plan', auth, controller.admin.member.activatePlan);
  router.get('/api/admin/member/stats', auth, controller.admin.member.stats);
  router.get('/api/admin/member/points-logs', auth, controller.admin.member.pointsLogs);

  // ==================== 工具（H5 端） ====================
  router.get('/api/tools/home', controller.tool.home);
  router.get('/api/tools/feature', controller.tool.featureList);
  router.get('/api/tools/member', controller.tool.memberList);
  router.get('/api/tools/:code/access', auth, controller.tool.checkAccess);

  // ==================== 工具分类管理（管理端） ====================
  router.get('/api/admin/tool-categories', auth, controller.admin.tool.listCategories);
  router.post('/api/admin/tool-categories', auth, controller.admin.tool.createCategory);
  router.put('/api/admin/tool-categories/:id', auth, controller.admin.tool.updateCategory);
  router.delete('/api/admin/tool-categories/:id', auth, controller.admin.tool.deleteCategory);

  // ==================== 工具管理（管理端） ====================
  // 注意: batch-publish 必须放在 :id 路由之前，避免被 :id 参数捕获
  router.put('/api/admin/tools/batch-publish', auth, controller.admin.tool.batchPublish);
  router.get('/api/admin/tools', auth, controller.admin.tool.listTools);
  router.get('/api/admin/tools/:id', auth, controller.admin.tool.showTool);
  router.post('/api/admin/tools', auth, controller.admin.tool.createTool);
  router.put('/api/admin/tools/:id', auth, controller.admin.tool.updateTool);
  router.delete('/api/admin/tools/:id', auth, controller.admin.tool.deleteTool);

  // ==================== 用户收藏工具 ====================
  // 注意: 精确路径（codes / reorder / check/:toolCode）必须放在 /:toolCode 之前
  router.get('/api/favorites/codes', auth, controller.favorite.codes);
  router.put('/api/favorites/reorder', auth, controller.favorite.reorder);
  router.get('/api/favorites/check/:toolCode', auth, controller.favorite.check);
  router.get('/api/favorites', auth, controller.favorite.index);
  router.post('/api/favorites', auth, controller.favorite.create);
  router.delete('/api/favorites/:toolCode', auth, controller.favorite.destroy);
};
