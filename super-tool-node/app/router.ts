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

  // ==================== 用户管理增强（Spec-C2a） ====================
  router.post('/api/admin/users/:id/reset-password', auth, perm('user:reset-password'), controller.user.resetPassword);
  router.put('/api/admin/users/:id/status', auth, perm('user:disable'), controller.user.changeStatus);
  router.put('/api/admin/users/:id/roles', auth, perm('user:assign-roles'), controller.user.assignRoles);
  router.get('/api/admin/users/:id/devices', auth, perm('user:device:list'), controller.user.adminListDevices);
  router.get('/api/admin/users/:id/addresses', auth, perm('user:address:list'), controller.user.adminListAddresses);

  // ==================== 角色管理 ====================
  router.get('/api/admin/roles', auth, perm('system:role:list'), controller.admin.role.index);
  router.get('/api/admin/roles/:id', auth, perm('system:role:detail'), controller.admin.role.show);
  router.post('/api/admin/roles', auth, perm('system:role:create'), controller.admin.role.create);
  router.put('/api/admin/roles/:id', auth, perm('system:role:update'), controller.admin.role.update);
  router.delete('/api/admin/roles/:id', auth, perm('system:role:delete'), controller.admin.role.destroy);
  router.put('/api/admin/roles/:id/permissions', auth, perm('system:role:assign-permissions'), controller.admin.role.assignPermissions);

  // ==================== 角色-用户关联 ====================
  router.get('/api/admin/roles/:id/users', auth, perm('system:role:assign-users'), controller.admin.role.users);
  router.put('/api/admin/roles/:id/users', auth, perm('system:role:assign-users'), controller.admin.role.assignUsers);
  router.delete('/api/admin/roles/:id/users/:userId', auth, perm('system:role:assign-users'), controller.admin.role.removeUser);

  // ==================== 权限管理 ====================
  // 注意：精确路径（tree/modules/test）必须放在 :id 之前，否则被 :id 参数吞掉
  router.get('/api/admin/permissions/tree', auth, perm('system:permission:tree'), controller.admin.permission.tree);
  router.get('/api/admin/permissions/modules', auth, perm('system:permission:tree'), controller.admin.permission.modules);
  router.get('/api/admin/permissions/test', auth, perm('system:permission-test:run'), (controller.admin as any).permission.test);
  router.get('/api/admin/permissions/:id', auth, perm('system:permission:list'), controller.admin.permission.show);
  router.post('/api/admin/permissions', auth, perm('system:permission:create'), controller.admin.permission.create);
  router.put('/api/admin/permissions/:id', auth, perm('system:permission:update'), controller.admin.permission.update);
  router.delete('/api/admin/permissions/:id', auth, perm('system:permission:delete'), controller.admin.permission.destroy);

  // ==================== 管理端用户自查（菜单/权限码） ====================
  // 注意：仅挂 auth，不挂 perm —— 用户登录即可访问
  // 类型断言绕过 egg-ts-helper typings 滞后；运行时由 Egg 按文件系统加载，无问题
  const adminCtrl = controller.admin as any;
  router.get('/api/admin/auth/menus', auth, adminCtrl.auth.menus);
  router.get('/api/admin/auth/permissions', auth, adminCtrl.auth.permissions);

  // ==================== 权限-角色联动 ====================
  router.get('/api/admin/permissions/:id/holders', auth, perm('system:permission:holders'), adminCtrl.permission.holders);
  router.put('/api/admin/permissions/:id/batch-assign', auth, perm('system:permission:batch-assign'), adminCtrl.permission.batchAssign);

  // ==================== 审计日志 ====================
  // 注意：export 路由必须放在 :id 之前，否则 /export 被 :id 吞掉
  router.get('/api/admin/audit-logs', auth, perm('system:audit-log:list'), adminCtrl.auditLog.list);
  router.get('/api/admin/audit-logs/export', auth, perm('system:audit-log:export'), adminCtrl.auditLog.exportCsv);
  router.get('/api/admin/audit-logs/:id', auth, perm('system:audit-log:detail'), adminCtrl.auditLog.detail);

  // ==================== 反馈（C 端） ====================
  // 可登录可不登录（controller 内手动解析 token）；限流 10 req/h/IP
  const userCtrl = controller as any;
  router.post('/api/feedback', app.middleware.rateLimit({ max: 10, window: 3600 }, app), userCtrl.feedback.create);
  // 用户端：我的反馈（需登录）
  router.get('/api/feedback/mine', auth, userCtrl.feedback.myList);
  router.get('/api/feedback/mine/:id', auth, userCtrl.feedback.myDetail);

  // ==================== 反馈（管理端） ====================
  // 注意：精确路径（stats / pending-count）必须放在 :id 之前，否则被 :id 参数吞掉
  router.get('/api/admin/feedbacks', auth, perm('feedback:list'), adminCtrl.feedback.list);
  router.get('/api/admin/feedbacks/stats/overview', auth, perm('feedback:stats:overview'), adminCtrl.feedback.statsOverview);
  router.get('/api/admin/feedbacks/stats/trend', auth, perm('feedback:stats:trend'), adminCtrl.feedback.statsTrend);
  router.get('/api/admin/feedbacks/pending-count', auth, perm('feedback:pending-count'), adminCtrl.feedback.pendingCount);
  router.post('/api/admin/feedbacks/:id/reply', auth, perm('feedback:reply'), adminCtrl.feedback.reply);
  router.put('/api/admin/feedbacks/:id', auth, perm('feedback:update'), adminCtrl.feedback.update);
  router.delete('/api/admin/feedbacks/:id', auth, perm('feedback:delete'), adminCtrl.feedback.destroy);
  router.get('/api/admin/feedbacks/:id', auth, perm('feedback:detail'), adminCtrl.feedback.detail);

  // ==================== 反馈话术（管理端） ====================
  // 注意：精确路径必须放在 :id 之前
  // 分类
  router.get('/api/admin/feedback/snippet-categories', auth, perm('feedback:snippet:category:list'), adminCtrl.feedbackSnippetCategory.tree);
  router.post('/api/admin/feedback/snippet-categories', auth, perm('feedback:snippet:category:create'), adminCtrl.feedbackSnippetCategory.create);
  router.put('/api/admin/feedback/snippet-categories/:id/role-permissions', auth, perm('feedback:snippet:category:role-perm'), adminCtrl.feedbackSnippetCategory.setRolePermissions);
  router.get('/api/admin/feedback/snippet-categories/:id/role-permissions', auth, perm('feedback:snippet:category:role-perm'), adminCtrl.feedbackSnippetCategory.getRolePermissions);
  router.put('/api/admin/feedback/snippet-categories/:id', auth, perm('feedback:snippet:category:update'), adminCtrl.feedbackSnippetCategory.update);
  router.delete('/api/admin/feedback/snippet-categories/:id', auth, perm('feedback:snippet:category:delete'), adminCtrl.feedbackSnippetCategory.destroy);
  router.get('/api/admin/feedback/snippet-categories/:id', auth, perm('feedback:snippet:category:detail'), adminCtrl.feedbackSnippetCategory.detail);

  // 话术 - 精确路径优先
  router.get('/api/admin/feedback/snippets/picker', auth, perm('feedback:snippet:picker'), adminCtrl.feedbackSnippet.picker);
  router.get('/api/admin/feedback/snippets/recommend', auth, perm('feedback:snippet:recommend'), adminCtrl.feedbackSnippet.recommend);
  router.get('/api/admin/feedback/snippets/stats/overview', auth, perm('feedback:snippet:stats'), adminCtrl.feedbackSnippet.statsOverview);
  router.get('/api/admin/feedback/snippets/stats/top', auth, perm('feedback:snippet:stats'), adminCtrl.feedbackSnippet.statsTop);
  router.get('/api/admin/feedback/snippets/stats/trend', auth, perm('feedback:snippet:stats'), adminCtrl.feedbackSnippet.statsTrend);
  router.get('/api/admin/feedback/snippets/export', auth, perm('feedback:snippet:export'), adminCtrl.feedbackSnippet.exportAll);
  router.post('/api/admin/feedback/snippets/import', auth, perm('feedback:snippet:import-api'), adminCtrl.feedbackSnippet.importData);
  // 话术 - :id 子路径
  router.post('/api/admin/feedback/snippets/:id/publish', auth, perm('feedback:snippet:publish-api'), adminCtrl.feedbackSnippet.publish);
  router.post('/api/admin/feedback/snippets/:id/disable', auth, perm('feedback:snippet:disable-api'), adminCtrl.feedbackSnippet.disable);
  router.post('/api/admin/feedback/snippets/:id/rollback/:versionId', auth, perm('feedback:snippet:rollback-api'), adminCtrl.feedbackSnippet.rollback);
  router.get('/api/admin/feedback/snippets/:id/versions', auth, perm('feedback:snippet:versions'), adminCtrl.feedbackSnippet.versions);
  router.post('/api/admin/feedback/snippets/:id/render', auth, perm('feedback:snippet:render'), adminCtrl.feedbackSnippet.render);
  router.post('/api/admin/feedback/snippets/:id/usage', auth, perm('feedback:snippet:usage'), adminCtrl.feedbackSnippet.usage);
  // 话术 - CRUD
  router.get('/api/admin/feedback/snippets', auth, perm('feedback:snippet:view'), adminCtrl.feedbackSnippet.list);
  router.post('/api/admin/feedback/snippets', auth, perm('feedback:snippet:create'), adminCtrl.feedbackSnippet.create);
  router.put('/api/admin/feedback/snippets/:id', auth, perm('feedback:snippet:update'), adminCtrl.feedbackSnippet.update);
  router.delete('/api/admin/feedback/snippets/:id', auth, perm('feedback:snippet:delete'), adminCtrl.feedbackSnippet.destroy);
  router.get('/api/admin/feedback/snippets/:id', auth, perm('feedback:snippet:detail'), adminCtrl.feedbackSnippet.detail);

  // ==================== 数据统计 ====================
  router.get('/api/admin/stats/overview', auth, perm('stats:overview'), adminCtrl.stats.overview);
  router.get('/api/admin/stats/tool-usage', auth, perm('stats:tool-usage'), adminCtrl.stats.toolUsage);
  router.get('/api/admin/stats/user-active', auth, perm('stats:user-active'), adminCtrl.stats.userActive);
  router.get('/api/admin/stats/trend', auth, perm('stats:trend'), adminCtrl.stats.trend);
  router.get('/api/admin/stats/export', auth, perm('stats:export'), adminCtrl.stats.exportCsv);

  // ==================== Stats 扩展 (Dashboard Phase 1) ====================
  router.get('/api/admin/stats/user-retention', auth, perm('stats:overview'), adminCtrl.stats.userRetention);
  router.get('/api/admin/stats/active-hours', auth, perm('stats:overview'), adminCtrl.stats.activeHours);
  router.get('/api/admin/stats/tool-category', auth, perm('stats:overview'), adminCtrl.stats.toolCategory);
  router.get('/api/admin/stats/operation-efficiency', auth, perm('stats:overview'), adminCtrl.stats.operationEfficiency);
  router.get('/api/admin/stats/user-growth', auth, perm('stats:overview'), adminCtrl.stats.userGrowth);

  // ==================== Stats 扩展 (Dashboard Phase 2 - 部门视图) ====================
  router.get('/api/admin/stats/department/overview', auth, perm('stats:overview'), adminCtrl.stats.departmentOverview);
  router.get('/api/admin/stats/department/compare', auth, perm('stats:overview'), adminCtrl.stats.departmentCompare);
  router.get('/api/admin/stats/department/collaboration', auth, perm('stats:overview'), adminCtrl.stats.departmentCollaboration);

  // ==================== Dashboard ====================
  router.get('/api/admin/dashboard', auth, perm('dashboard:view'), controller.admin.dashboard.index);
  router.get('/api/admin/dashboard/system-status', auth, perm('dashboard:view'), controller.admin.dashboard.systemStatus);
  router.get('/api/admin/dashboard/mobile-summary', auth, controller.admin.dashboard.mobileSummary);
  router.get('/api/admin/dashboard/push-settings', auth, controller.admin.dashboard.getPushSettings);
  router.post('/api/admin/dashboard/push-settings', auth, controller.admin.dashboard.savePushSettings);

  // ==================== 可视化配置 (Dashboard Phase 4) ====================
  router.get('/api/admin/dashboard/layouts', auth, perm('dashboard:view'), controller.admin.layout.list);
  router.get('/api/admin/dashboard/layouts/:id', auth, perm('dashboard:view'), controller.admin.layout.show);
  router.post('/api/admin/dashboard/layouts', auth, perm('dashboard:view'), controller.admin.layout.create);
  router.put('/api/admin/dashboard/layouts/:id', auth, perm('dashboard:view'), controller.admin.layout.update);
  router.delete('/api/admin/dashboard/layouts/:id', auth, perm('dashboard:view'), controller.admin.layout.destroy);
  router.put('/api/admin/dashboard/layouts/:id/default', auth, perm('dashboard:view'), controller.admin.layout.setDefault);
  router.post('/api/admin/dashboard/layouts/:id/share', auth, perm('dashboard:view'), controller.admin.layout.share);
  router.get('/api/admin/dashboard/shared/:token', controller.admin.layout.getShared);

  // ==================== 智能预警 (Dashboard Phase 3) ====================
  router.get('/api/admin/alerts/rules', auth, perm('dashboard:view'), controller.admin.alert.listRules);
  router.post('/api/admin/alerts/rules', auth, perm('dashboard:view'), controller.admin.alert.createRule);
  router.put('/api/admin/alerts/rules/:id', auth, perm('dashboard:view'), controller.admin.alert.updateRule);
  router.delete('/api/admin/alerts/rules/:id', auth, perm('dashboard:view'), controller.admin.alert.deleteRule);
  router.put('/api/admin/alerts/rules/:id/toggle', auth, perm('dashboard:view'), controller.admin.alert.toggleRule);
  router.get('/api/admin/alerts/logs', auth, perm('dashboard:view'), controller.admin.alert.listLogs);
  router.put('/api/admin/alerts/logs/:id/acknowledge', auth, perm('dashboard:view'), controller.admin.alert.acknowledgLog);
  router.put('/api/admin/alerts/logs/:id/resolve', auth, perm('dashboard:view'), controller.admin.alert.resolveLog);
  router.get('/api/admin/alerts/summary', auth, perm('dashboard:view'), controller.admin.alert.summary);

  // ==================== 会员体系（C 端，用户自用） ====================
  router.get('/api/member/levels', controller.member.levels);
  router.get('/api/member/plans', controller.member.plans);
  router.get('/api/member/info', auth, controller.member.info);
  router.get('/api/member/benefits', auth, controller.member.benefits);
  router.get('/api/member/points-logs', auth, controller.member.pointsLogs);
  router.post('/api/member/daily-sign', auth, controller.member.dailySign);
  router.post('/api/member/become-member', auth, controller.member.becomeMember);

  // ==================== 订单（C 端） ====================
  router.post('/api/orders/preview', auth, (controller as any).order.preview);
  router.post('/api/orders', auth, (controller as any).order.create);
  router.get('/api/orders', auth, (controller as any).order.list);
  router.get('/api/orders/:id', auth, (controller as any).order.detail);
  router.post('/api/orders/:id/cancel', auth, (controller as any).order.cancel);

  // ==================== 支付（C 端） ====================
  // 公开（无需 auth）
  router.get('/api/payments/providers', (controller as any).payment.listProviders);
  router.post('/api/payments', auth, (controller as any).payment.create);
  router.get('/api/payments/:paymentNo/status', auth, (controller as any).payment.status);
  // Mock 内部回调（不挂 auth；生产环境应配置内部 IP 白名单或 hmac 校验）
  router.post('/api/payments/mock/notify', (controller as any).payment.mockNotify);
  // 真实微信回调（占位，本 MVP 不实装）
  router.post('/api/payments/wechat/notify', (controller as any).payment.wechatNotify);
  // Alipay 异步通知 + 同步跳转（公开，alipay 网关直接调）
  router.post('/api/payments/alipay/notify', (controller as any).payment.alipayNotify);
  router.get('/api/payments/alipay/return', (controller as any).payment.alipayReturn);

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

  // 订单管理（精确路径 /stats 必须在 /:id 之前；权限码定义见 database/022_add_order_module.sql）
  router.get('/api/admin/member/orders/stats', auth, perm('member:order:stats'), (controller.admin as any).order.stats);
  router.get('/api/admin/member/orders', auth, perm('member:order:list'), (controller.admin as any).order.list);
  router.get('/api/admin/member/orders/:id', auth, perm('member:order:detail'), (controller.admin as any).order.detail);

  // 退款管理（Phase 2 — 权限码定义见 database/024_add_phase2_refund_upgrade.sql）
  router.post('/api/admin/member/orders/:id/refund', auth, perm('member:refund:create'), (controller.admin as any).refund.create);
  router.get('/api/admin/member/refunds', auth, perm('member:order:list'), (controller.admin as any).refund.list);
  router.get('/api/admin/member/refunds/:id', auth, perm('member:order:detail'), (controller.admin as any).refund.detail);

  // 开发期调度触发（Phase 2 — 仅 admin 可用，super_admin 默认拥有）
  router.post('/api/admin/dev/trigger-schedule', auth, perm('system:dev:trigger-schedule'), (controller.admin as any).scheduleTrigger.trigger);

  // ==================== 工具（H5 端） ====================
  router.get('/api/tools/home', controller.tool.home);
  router.get('/api/tools/feature', controller.tool.featureList);
  router.get('/api/tools/member', controller.tool.memberList);
  router.get('/api/tools/:code/access', auth, controller.tool.checkAccess);

  // ==================== 积分商城（H5 端） ====================
  router.get('/api/points-mall/items', controller.pointsMall.items);
  router.post('/api/points-mall/exchange', auth, app.middleware.rateLimit({ max: 5, window: 60 }, app), controller.pointsMall.exchange);
  router.get('/api/points-mall/orders', auth, controller.pointsMall.orders);
  router.get('/api/points-mall/coupons', auth, controller.pointsMall.coupons);
  router.post('/api/points-mall/coupons/use', auth, app.middleware.rateLimit({ max: 10, window: 60 }, app), controller.pointsMall.useCoupon);
  router.get('/api/points-mall/unlocked-tools', auth, controller.pointsMall.unlockedTools);

  // ==================== 优惠券（H5 端） ====================
  router.get('/api/coupons/available-for-subscription', auth, controller.coupon.availableForSubscription);

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

  // ==================== 通知管理（管理端） ====================
  const nCtrl = adminCtrl.notification;

  // 类型
  router.get('/api/admin/notification/types', auth, perm('notification:type:view'), nCtrl.type.list);
  router.post('/api/admin/notification/types', auth, perm('notification:type:manage'), nCtrl.type.create);
  router.put('/api/admin/notification/types/:id', auth, perm('notification:type:manage'), nCtrl.type.update);
  router.delete('/api/admin/notification/types/:id', auth, perm('notification:type:manage'), nCtrl.type.destroy);

  // 模板
  router.get('/api/admin/notification/templates', auth, perm('notification:template:view'), nCtrl.template.list);
  router.get('/api/admin/notification/templates/:id', auth, perm('notification:template:view'), nCtrl.template.detail);
  router.post('/api/admin/notification/templates', auth, perm('notification:template:manage'), nCtrl.template.create);
  router.put('/api/admin/notification/templates/:id', auth, perm('notification:template:manage'), nCtrl.template.update);
  router.post('/api/admin/notification/templates/:id/publish', auth, perm('notification:template:publish'), nCtrl.template.publish);
  router.post('/api/admin/notification/templates/:id/preview', auth, perm('notification:template:view'), nCtrl.template.preview);
  router.post('/api/admin/notification/templates/:id/test-send', auth, perm('notification:template:manage'), nCtrl.template.testSend);
  router.post('/api/admin/notification/templates/:id/rollback/:versionId', auth, perm('notification:template:publish'), nCtrl.template.rollback);

  // 任务
  router.get('/api/admin/notification/tasks', auth, perm('notification:task:view'), nCtrl.task.list);
  router.get('/api/admin/notification/tasks/:id', auth, perm('notification:task:view'), nCtrl.task.detail);
  router.post('/api/admin/notification/tasks', auth, perm('notification:task:create'), nCtrl.task.create);
  router.post('/api/admin/notification/tasks/scheduled', auth, perm('notification:task:create'), nCtrl.task.createScheduled);
  router.post('/api/admin/notification/tasks/:id/pause', auth, perm('notification:task:control'), nCtrl.task.pause);
  router.post('/api/admin/notification/tasks/:id/resume', auth, perm('notification:task:control'), nCtrl.task.resume);
  router.post('/api/admin/notification/tasks/:id/cancel', auth, perm('notification:task:control'), nCtrl.task.cancel);
  router.post('/api/admin/notification/tasks/:id/undo', auth, perm('notification:task:control'), nCtrl.task.undo);

  // 消息（管理员视角）
  router.get('/api/admin/notification/messages', auth, perm('notification:message:view'), nCtrl.message.list);
  router.get('/api/admin/notification/messages/:id', auth, perm('notification:message:view'), nCtrl.message.detail);

  // 频控规则
  router.get('/api/admin/notification/rate-limits', auth, perm('notification:config:manage'), nCtrl.rateLimit.list);
  router.post('/api/admin/notification/rate-limits', auth, perm('notification:config:manage'), nCtrl.rateLimit.create);
  router.put('/api/admin/notification/rate-limits/:id', auth, perm('notification:config:manage'), nCtrl.rateLimit.update);
  router.delete('/api/admin/notification/rate-limits/:id', auth, perm('notification:config:manage'), nCtrl.rateLimit.destroy);

  // 渠道配置
  router.get('/api/admin/notification/channels', auth, perm('notification:config:manage'), nCtrl.channel.list);
  router.put('/api/admin/notification/channels/:id', auth, perm('notification:config:manage'), nCtrl.channel.update);
  router.post('/api/admin/notification/channels/test-smtp', auth, perm('notification:config:manage'), nCtrl.channel.testSmtp);

  // 受众分组
  router.get('/api/admin/notification/audiences/fields', auth, perm('notification:audience:view'), nCtrl.audience.fieldWhitelist);
  router.post('/api/admin/notification/audiences/preview', auth, perm('notification:audience:view'), nCtrl.audience.preview);
  router.get('/api/admin/notification/audiences', auth, perm('notification:audience:view'), nCtrl.audience.list);
  router.get('/api/admin/notification/audiences/:id', auth, perm('notification:audience:view'), nCtrl.audience.detail);
  router.post('/api/admin/notification/audiences', auth, perm('notification:audience:manage'), nCtrl.audience.create);
  router.put('/api/admin/notification/audiences/:id', auth, perm('notification:audience:manage'), nCtrl.audience.update);
  router.delete('/api/admin/notification/audiences/:id', auth, perm('notification:audience:manage'), nCtrl.audience.destroy);

  // 统计
  router.get('/api/admin/notification/stats/overview', auth, perm('notification:stats:view'), nCtrl.stats.overview);
  router.get('/api/admin/notification/stats/trend', auth, perm('notification:stats:view'), nCtrl.stats.trend);
  router.get('/api/admin/notification/stats/by-channel', auth, perm('notification:stats:view'), nCtrl.stats.byChannel);
  router.get('/api/admin/notification/stats/by-type', auth, perm('notification:stats:view'), nCtrl.stats.byType);
  router.get('/api/admin/notification/stats/funnel', auth, perm('notification:stats:view'), nCtrl.stats.funnel);

  // 导出
  router.post('/api/admin/notification/exports', auth, perm('notification:export:create'), nCtrl.export.create);
  router.get('/api/admin/notification/exports', auth, perm('notification:export:create'), nCtrl.export.list);
  router.get('/api/admin/notification/exports/:id/download', auth, perm('notification:export:create'), nCtrl.export.download);

  // Schedule
  router.get('/api/admin/notification/schedules', auth, perm('notification:config:manage'), nCtrl.schedule.list);
  router.post('/api/admin/notification/schedules/:id/pause', auth, perm('notification:config:manage'), nCtrl.schedule.pause);
  router.post('/api/admin/notification/schedules/:id/resume', auth, perm('notification:config:manage'), nCtrl.schedule.resume);

  // 队列监控
  router.get('/api/admin/notification/queues/depths', auth, perm('notification:stats:view'), nCtrl.queueMonitor.depths);

  // ==================== 通知（C 端用户） ====================
  router.get('/api/notification-types', auth, controller.notification.listTypes);
  router.get('/api/notifications/unread-count', auth, controller.notification.unreadCount);
  router.post('/api/notifications/mark-read', auth, controller.notification.markRead);
  router.post('/api/notifications/mark-all-read', auth, controller.notification.markAllRead);
  router.get('/api/notification-preferences', auth, controller.notification.listPreferences);
  router.put('/api/notification-preferences', auth, controller.notification.upsertPreference);
  router.post('/api/notifications/:id/archive', auth, controller.notification.archive);
  router.get('/api/notifications/:id', auth, controller.notification.detail);
  router.get('/api/notifications', auth, controller.notification.list);

  // 地区相关（注意顺序：精确路由在前，动态路由在后）
  router.get('/api/region/all',                controller.region.getAll)
  router.get('/api/region/provinces',          controller.region.getProvinces)
  router.get('/api/region/search',             controller.region.search)
  router.get('/api/region/children/:parentId', controller.region.getChildren)
  router.get('/api/region/path/:id',           controller.region.getPath)
  router.get('/api/region/:id',                controller.region.getById)
  router.post('/api/region/refresh-cache',     controller.region.refreshCache)

  // ==================== 积分体系（C 端，用户自用） ====================
  // 设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 17
  //          docs/analysis/积分与成长体系深度评估报告.md §8.2 限流规则
  //
  // 写入类路由（claim / exchange / sign）挂 rateLimit + Idempotency-Key 中间件
  // 读取类路由仅 auth，不强制幂等
  //
  // Plan A · Task A7：
  //   - idem (兼容版, enforce=false)：未带 Idempotency-Key 也放行，预留给未来非关键写入路由
  //   - idemEnforced (强制版, enforce=true)：未带 Idempotency-Key 直接 400
  //     用于 sign / claim / exchange 三个扣资源接口，杜绝重放双花
  const idem = (app.middleware as any).idempotency({ ttlHours: 24 }, app);
  const idemEnforced = (app.middleware as any).idempotency({ ttlHours: 24, enforce: true }, app);
  // 兼容引用：保留 idem 供未来扩展（当前未使用，关闭 lint 警告）
  void idem;
  const rl = (max: number, windowSec: number) =>
    (app.middleware as any).rateLimit({ max, window: windowSec }, app);

  // 签到（业务上 user_signs 唯一索引强制 1/天，rateLimit 兜底防爆刷；强制带 Idempotency-Key）
  router.post('/api/sign', auth, rl(10, 60), idemEnforced, (controller as any).sign.create);
  router.get('/api/sign/status', auth, (controller as any).sign.status);

  // 任务中心（claim 强制带 Idempotency-Key，防 onClaim 重复发奖）
  router.get('/api/tasks', auth, (controller as any).task.index);
  router.post('/api/tasks/:code/claim', auth, rl(10, 60), idemEnforced, (controller as any).task.claim);

  // 积分商城（exchange 强制带 Idempotency-Key，防扣积分重复）
  router.get('/api/points-mall/items', auth, (controller as any).pointsMall.items);
  router.post('/api/points-mall/exchange', auth, rl(5, 60), idemEnforced, (controller as any).pointsMall.exchange);
  router.get('/api/points-mall/orders', auth, (controller as any).pointsMall.orders);
  // 券管理
  router.get('/api/points-mall/coupons', auth, (controller as any).pointsMall.coupons);
  router.post('/api/points-mall/coupons/use', auth, rl(10, 60), (controller as any).pointsMall.useCoupon);

  // ==================== 积分体系（管理端） ====================
  // 任务管理
  router.get('/api/admin/points/tasks', auth, perm('points:task:list'), (controller.admin as any).task.list);
  router.post('/api/admin/points/tasks', auth, perm('points:task:create'), (controller.admin as any).task.create);
  router.put('/api/admin/points/tasks/:id', auth, perm('points:task:update'), (controller.admin as any).task.update);
  router.delete('/api/admin/points/tasks/:id', auth, perm('points:task:delete'), (controller.admin as any).task.destroy);

  // 商城商品 + 订单管理
  router.get('/api/admin/points/mall/items', auth, perm('points:mall:list'), (controller.admin as any).pointsMall.items);
  router.post('/api/admin/points/mall/items', auth, perm('points:mall:manage'), (controller.admin as any).pointsMall.createItem);
  router.put('/api/admin/points/mall/items/:id', auth, perm('points:mall:manage'), (controller.admin as any).pointsMall.updateItem);
  router.get('/api/admin/points/mall/orders', auth, perm('points:mall:orders'), (controller.admin as any).pointsMall.orders);
  router.post('/api/admin/points/mall/orders/:id/refund', auth, perm('points:mall:refund'), (controller.admin as any).pointsMall.refundOrder);

  // 运维：过期统计 / 对账查询 / 手工触发定时任务
  router.get('/api/admin/points/expire/stats', auth, perm('points:expire:stats'), (controller.admin as any).pointsOps.expireStats);
  router.get('/api/admin/points/reconcile', auth, perm('points:reconcile:view'), (controller.admin as any).pointsOps.reconcile);
  router.post('/api/admin/points/ops/trigger', auth, perm('points:ops:trigger'), (controller.admin as any).pointsOps.trigger);

  // Plan A · Task A7/A8: pointsRule 缓存清理（管理端配置变更后热更）
  //   路径与 plan A8 设计一致：POST /api/admin/points/cache/clear?levelId=X
  //   - 不传 levelId：清空全部等级缓存
  //   - 传 levelId：仅清单个等级
  router.post('/api/admin/points/cache/clear', auth, perm('points:ops:trigger'), (controller.admin as any).pointsOps.clearRuleCache);

  // Plan §Task 12: 领域事件追溯
  //   - GET  /api/admin/points/events                  列表查询（多维度筛选 + 分页）
  //   - POST /api/admin/points/events/:id/retry        失败事件重试派发
  //   权限码 points:events:list / points:events:retry 由 028 SQL 落库
  router.get('/api/admin/points/events', auth, perm('points:events:list'), (controller.admin as any).pointsOps.eventsList);
  router.post('/api/admin/points/events/:id/retry', auth, perm('points:events:retry'), (controller.admin as any).pointsOps.eventsRetry);

  // Plan §Task 13: 退款账本（B1 灰度）
  //   - GET /api/admin/points/refund-ledger            查 metadata.scenario='B1_REFUND' 流水
  //   - GET /api/admin/points/refund-ledger/flag       读 system_configs.refund.reverse_fifo
  //   权限码 points:refund-ledger:list / points:refund-ledger:flag 由 028 SQL 落库
  //   注：精确路径 /flag 必须放在通用列表之前，避免被 :id 类参数吞掉（虽然此处暂无 :id，预留约定）
  router.get('/api/admin/points/refund-ledger/flag', auth, perm('points:refund-ledger:flag'), (controller.admin as any).pointsOps.refundLedgerFlag);
  router.get('/api/admin/points/refund-ledger', auth, perm('points:refund-ledger:list'), (controller.admin as any).pointsOps.refundLedgerList);

  // ==================== Socket.IO 路由（通知命名空间） ====================
  const io = (app as any).io;
  if (io) {
    io.of('/notification').route('disconnect', io.controller.notification.disconnect);
    io.of('/notification').route('heartbeat', io.controller.notification.heartbeat);
  }
};
