import BaseController from './base';

export default class UserController extends BaseController {

  /** GET /api/users */
  async index() {
    const pagination = this.getPagination();
    const { keyword, status, userType, startDate, endDate } = this.ctx.query;
    const result = await this.service.user.findList({
      ...pagination, keyword, status: status !== undefined ? Number(status) : undefined,
      userType: userType !== undefined ? Number(userType) : undefined, startDate, endDate,
    });
    this.paginated(result);
  }

  /** GET /api/users/:id */
  async show() {
    const user = await this.service.user.findById(Number(this.ctx.params.id));
    if (!user) this.ctx.throw(404, '用户不存在');
    this.success(user);
  }

  /** POST /api/users */
  async create() {
    this.validate({
      username: { type: 'string', min: 3, max: 50 },
      email: { type: 'email', required: false },
      password: { type: 'string', min: 8 },
      phone: { type: 'string', required: false },
      nickname: { type: 'string', required: false },
    });
    const body = this.ctx.request.body;
    try {
      const user = await this.service.user.create(body);
      // afterData 中剔除 password / passwordHash
      const safeAfter = this._stripSensitive(user);
      await this.service.audit.log({
        module: 'user', action: 'create',
        bizType: 'user', bizId: (user as any)?.id,
        afterData: safeAfter,
        description: `创建用户 ${body?.username || ''}`,
        status: 1,
      });
      this.created(user);
    } catch (e: any) {
      await this.service.audit.log({
        module: 'user', action: 'create',
        description: `尝试创建用户 ${body?.username || '(未知)'}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/users/:id */
  async update() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try {
      const raw = await this.service.user.findById(id);
      beforeData = this._stripSensitive(raw);
    } catch { /* ignore */ }

    try {
      const user = await this.service.user.update(id, this.ctx.request.body);
      const safeAfter = this._stripSensitive(user);
      await this.service.audit.log({
        module: 'user', action: 'update',
        bizType: 'user', bizId: id,
        beforeData, afterData: safeAfter,
        description: `更新用户 #${id}`,
        status: 1,
      });
      this.success(user, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'user', action: 'update',
        bizType: 'user', bizId: id,
        beforeData,
        description: `尝试更新用户 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/users/:id */
  async destroy() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try {
      const raw = await this.service.user.findById(id);
      beforeData = this._stripSensitive(raw);
    } catch { /* ignore */ }

    try {
      await this.service.user.delete(id);
      await this.service.audit.log({
        module: 'user', action: 'delete',
        bizType: 'user', bizId: id,
        beforeData,
        description: `删除用户 #${id}`,
        status: 1,
      });
      this.success(null, '删除成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'user', action: 'delete',
        bizType: 'user', bizId: id,
        beforeData,
        description: `尝试删除用户 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** 剔除用户对象中的敏感字段（password / passwordHash） */
  private _stripSensitive(u: any): any {
    if (!u) return u;
    try {
      const cloned = JSON.parse(JSON.stringify(u));
      delete cloned.password;
      delete cloned.passwordHash;
      delete cloned.password_hash;
      return cloned;
    } catch { return null; }
  }

  /** GET /api/users/profile — 基础资料 */
  async profile() {
    const user = await this.service.user.findById(this.ctx.state.user.id);
    this.success(user);
  }

  /** GET /api/users/profile/extra — 完整资料（基础 + 扩展） */
  async profileExtra() {
    const result = await this.service.user.getProfileExtra(this.ctx.state.user.id);
    this.success(result);
  }

  /** PUT /api/users/profile — 更新个人资料（基础 + 扩展） */
  async updateProfile() {
    const result = await this.service.user.updateProfile(this.ctx.state.user.id, this.ctx.request.body);
    this.success(result, '资料更新成功');
  }

  /** PUT /api/users/password
   *
   * 兼容两种场景：
   * - 已设密码用户（hasPassword=true）：必须传 oldPassword 做原密码校验
   * - 未设密码用户（hasPassword=false，例如手机号注册账户）：oldPassword 可省略，直接设置新密码
   *
   * 是否需要原密码由 service 层根据用户当前 passwordHash 是否存在判定，
   * 这里仅在请求体携带 oldPassword 时做类型校验。
   */
  async changePassword() {
    this.validate({
      oldPassword: { type: 'string', required: false, allowEmpty: true },
      newPassword: { type: 'string', min: 8 },
    });
    const { oldPassword, newPassword } = this.ctx.request.body;
    await this.service.user.changePassword(this.ctx.state.user.id, oldPassword, newPassword);
    this.success(null, '密码修改成功');
  }

  // ===== 设备管理 =====

  /** POST /api/users/devices — 注册/更新设备 */
  async registerDevice() {
    this.validate({
      deviceId: { type: 'string' },
      deviceType: { type: 'string' },
      deviceName: { type: 'string', required: false },
      osVersion: { type: 'string', required: false },
      appVersion: { type: 'string', required: false },
      pushToken: { type: 'string', required: false },
    });
    const result = await this.service.user.registerDevice(this.ctx.state.user.id, this.ctx.request.body);
    this.success(result);
  }

  /** GET /api/users/devices — 获取设备列表 */
  async listDevices() {
    const result = await this.service.user.listDevices(this.ctx.state.user.id);
    this.success(result);
  }

  /** DELETE /api/users/devices/:deviceId — 移除设备 */
  async removeDevice() {
    const { deviceId } = this.ctx.params;
    const result = await this.service.user.removeDevice(this.ctx.state.user.id, deviceId);
    this.success(result);
  }

  /** PUT /api/users/devices/:deviceId/push — 更新推送设置 */
  async updatePushSettings() {
    this.validate({ pushEnabled: { type: 'boolean' } });
    const { deviceId } = this.ctx.params;
    const { pushEnabled } = this.ctx.request.body;
    const result = await this.service.user.updatePushSettings(this.ctx.state.user.id, deviceId, pushEnabled);
    this.success(result);
  }

  // ===== 地址管理 =====
  /** GET /api/users/addresses */
  async listAddresses() {
    const result = await this.service.user.listAddresses(this.ctx.state.user.id);
    this.success(result);
  }

  /** POST /api/users/addresses */
  async addAddress() {
    this.validate({
      receiver: { type: 'string' }, phone: { type: 'string' },
      province: { type: 'string' }, city: { type: 'string' },
      district: { type: 'string' }, address: { type: 'string' },
    });
    const result = await this.service.user.addAddress(this.ctx.state.user.id, this.ctx.request.body);
    this.created(result);
  }

  /** PUT /api/users/addresses/:id */
  async updateAddress() {
    const result = await this.service.user.updateAddress(this.ctx.state.user.id, Number(this.ctx.params.id), this.ctx.request.body);
    this.success(result, '更新成功');
  }

  /** DELETE /api/users/addresses/:id */
  async deleteAddress() {
    await this.service.user.deleteAddress(this.ctx.state.user.id, Number(this.ctx.params.id));
    this.success(null, '删除成功');
  }
}
