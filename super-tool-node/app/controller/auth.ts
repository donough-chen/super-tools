import BaseController from './base';

export default class AuthController extends BaseController {

  /** POST /api/auth/login — 密码登录 */
  async login() {
    this.validate({
      username: { type: 'string' },
      password: { type: 'string' },
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      platform: { type: 'string', required: false },
      captcha: { type: 'string', required: false },
    });
    const result = await this.service.auth.login(this.ctx.request.body);
    this.success(result, '登录成功');
  }

  /** POST /api/auth/wechat-login — 微信登录（策略模式: miniprogram/h5/app） */
  async wechatLogin() {
    this.validate({
      code: { type: 'string' },
      platform: { type: 'string' },     // miniprogram | h5 | app | ios | android
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      userInfo: { type: 'object', required: false },  // 小程序端可选传用户信息
    });
    const result = await this.service.auth.wechatLogin(this.ctx.request.body);
    this.success(result, '微信登录成功');
  }

  /** POST /api/auth/phone-login — 手机号验证码登录 */
  async phoneLogin() {
    this.validate({
      phone: { type: 'string' },
      code: { type: 'string' },
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      platform: { type: 'string', required: false },
    });
    const result = await this.service.auth.phoneLogin(this.ctx.request.body);
    this.success(result, '登录成功');
  }

  /** GET /api/auth/wechat-auth-url — 获取微信H5授权URL */
  async getWechatAuthUrl() {
    const { redirectUri, state } = this.ctx.query;
    if (!redirectUri) {
      this.ctx.throw(400, 'redirectUri 参数不能为空');
    }
    const url = this.service.wechat.getH5AuthUrl(redirectUri as string, state as string);
    this.success({ url });
  }

  /** POST /api/auth/register — 注册 */
  async register() {
    this.validate({
      username: { type: 'string', min: 3, max: 50 },
      email: { type: 'email' },
      password: { type: 'string', min: 8 },
      clientId: { type: 'string' },
      nickname: { type: 'string', required: false },
      platform: { type: 'string', required: false },
      phone: { type: 'string', required: false, format: /^1[3-9]\d{9}$/ },
    });
    const result = await this.service.auth.register(this.ctx.request.body);
    this.created(result, '注册成功');
  }

  /** POST /api/auth/refresh — 刷新 Token */
  async refresh() {
    this.validate({ refreshToken: { type: 'string' } });
    const result = await this.service.auth.refreshToken(this.ctx.request.body.refreshToken);
    this.success(result, 'Token刷新成功');
  }

  /** POST /api/auth/logout — 登出 */
  async logout() {
    const sessionId = this.ctx.state.sessionId || this.ctx.request.body.sessionId;
    if (sessionId) await this.service.auth.logout(sessionId);
    this.success(null, '退出成功');
  }

  /**
   * GET /api/auth/me — 获取当前登录用户完整上下文
   * 返回: { user, roles: [{id,code,name,type}], permissions: string[] }
   * 前端用途：菜单渲染、按钮级权限控制、用户信息展示的统一入口
   */
  async me() {
    const { id: userId } = this.ctx.state.user;

    // 并发拉基础资料 / 角色 / 权限码
    const [ user, roles, permissions ] = await Promise.all([
      this.service.user.findById(userId),
      this.service.role.getUserRoles(userId),
      this.service.permission.getUserPermissionCodes(userId),
    ]);
    if (!user) this.ctx.throw(404, '用户不存在');

    // super_admin 判定统一基于 RBAC 角色码，不再依赖已废弃的 user_type 字段
    const isSuperAdmin = roles.some((r: any) => r.code === 'super_admin');

    this.success({
      user,
      roles,
      permissions,      // 数组（空数组时表示无任何显式权限）
      isSuperAdmin,     // true 时前端按"全量通过"处理
    });
  }

  /** POST /api/auth/send-code — 发送验证码 */
  async sendCode() {
    this.validate({
      target: { type: 'string' },
      type: { type: 'string' },
      platform: { type: 'string', required: false },
    });
    const result = await this.service.auth.sendVerifyCode(this.ctx.request.body);
    this.success(result);
  }

  /** GET /api/auth/sessions — 获取会话列表 */
  async sessions() {
    const { id } = this.ctx.state.user;
    try {
      const result = await this.service.auth.getSessions(id);
      this.success(result);
    } catch (err: any) {
      this.ctx.logger.error('[sessions] error:', err.message, err.stack);
      throw err;
    }
  }

  /** DELETE /api/auth/sessions/:id — 踢掉指定会话 */
  async kickSession() {
    const { id: sessionId } = this.ctx.params;
    const { id: userId } = this.ctx.state.user;
    await this.service.auth.kickSession(sessionId, userId);
    this.success(null, '会话已终止');
  }

  // ===== 账号绑定/解绑 =====

  /** POST /api/auth/bind/phone — 绑定手机号 */
  async bindPhone() {
    this.validate({
      phone: { type: 'string' },
      code: { type: 'string' },
    });
    const { phone, code } = this.ctx.request.body;
    const result = await this.service.auth.bindPhone(this.ctx.state.user.id, phone, code);
    this.success(result);
  }

  /** POST /api/auth/bind/wechat — 绑定微信 */
  async bindWechat() {
    this.validate({
      platform: { type: 'string' },  // miniprogram | h5 | app
      code: { type: 'string' },
    });
    const { platform, code } = this.ctx.request.body;
    const result = await this.service.auth.bindWechat(this.ctx.state.user.id, platform, code);
    this.success(result);
  }

  /** POST /api/auth/bind/email — 绑定邮箱 */
  async bindEmail() {
    this.validate({
      email: { type: 'email' },
      code: { type: 'string' },
    });
    const { email, code } = this.ctx.request.body;
    const result = await this.service.auth.bindEmail(this.ctx.state.user.id, email, code);
    this.success(result);
  }

  /** POST /api/auth/unbind — 解绑账号 */
  async unbind() {
    this.validate({
      type: { type: 'string' },          // phone | wechat | email
      platform: { type: 'string', required: false },  // 微信需指定 miniprogram/h5/app
    });
    const { type, platform } = this.ctx.request.body;
    const result = await this.service.auth.unbind(this.ctx.state.user.id, type, platform);
    this.success(result);
  }

  /** GET /api/auth/bind-status — 获取绑定状态 */
  async bindStatus() {
    const result = await this.service.auth.getBindStatus(this.ctx.state.user.id);
    this.success(result);
  }
}
