import { Service } from 'egg';
import * as crypto from 'crypto';

export default class LayoutService extends Service {

  /** 获取用户布局列表 + 系统默认 */
  async listLayouts(userId: number) {
    const { Op } = require('sequelize');
    const layouts = await this.ctx.model.DashboardLayout.findAll({
      where: { [Op.or]: [{ user_id: userId }, { user_id: null }] },
      order: [['is_default', 'DESC'], ['updated_at', 'DESC']],
    });
    return layouts;
  }

  /** 获取布局详情(含组件) */
  async getLayout(id: number, userId: number) {
    const layout = await this.ctx.model.DashboardLayout.findByPk(id);
    if (!layout) this.ctx.throw(404, '布局不存在');

    const l = layout as any;
    // 仅允许访问自己的或系统默认的
    if (l.userId !== null && l.userId !== userId) {
      this.ctx.throw(403, '无权访问此布局');
    }

    const widgets = await this.ctx.model.DashboardWidget.findAll({
      where: { layout_id: id },
      order: [['id', 'ASC']],
    });

    return { layout, widgets };
  }

  /** 创建布局(含组件) */
  async createLayout(userId: number, data: any) {
    const layout = await this.ctx.model.DashboardLayout.create({
      userId,
      name: data.name,
      description: data.description || null,
      layoutConfig: data.layoutConfig || { cols: 12, rowHeight: 80, margin: [16, 16] },
      isDefault: 0,
    });

    if (data.widgets?.length > 0) {
      await this.ctx.model.DashboardWidget.bulkCreate(
        data.widgets.map((w: any) => ({
          layoutId: (layout as any).id,
          widgetType: w.widgetType,
          title: w.title || null,
          dataConfig: w.dataConfig || {},
          styleConfig: w.styleConfig || null,
          position: w.position,
          refreshInterval: w.refreshInterval || 0,
        })),
      );
    }

    return layout;
  }

  /** 更新布局(含组件全量替换) */
  async updateLayout(id: number, userId: number, data: any) {
    const layout = await this.ctx.model.DashboardLayout.findByPk(id);
    if (!layout) this.ctx.throw(404, '布局不存在');
    const l = layout as any;
    // 系统默认布局不能被修改
    if (l.userId === null) {
      this.ctx.throw(400, '系统默认布局不可修改，请另存为新看板');
    }
    // 只能修改自己的布局
    if (l.userId !== userId) {
      this.ctx.throw(403, '无权修改此布局');
    }

    await layout.update({
      name: data.name ?? l.name,
      description: data.description ?? l.description,
      layoutConfig: data.layoutConfig ?? l.layoutConfig,
    });

    // 全量替换组件
    if (data.widgets !== undefined) {
      await this.ctx.model.DashboardWidget.destroy({ where: { layout_id: id } });
      if (data.widgets?.length > 0) {
        await this.ctx.model.DashboardWidget.bulkCreate(
          data.widgets.map((w: any) => ({
            layoutId: id,
            widgetType: w.widgetType,
            title: w.title || null,
            dataConfig: w.dataConfig || {},
            styleConfig: w.styleConfig || null,
            position: w.position,
            refreshInterval: w.refreshInterval || 0,
          })),
        );
      }
    }

    return layout;
  }

  /** 删除布局 */
  async deleteLayout(id: number, userId: number) {
    const layout = await this.ctx.model.DashboardLayout.findByPk(id);
    if (!layout) this.ctx.throw(404, '布局不存在');
    const l = layout as any;
    if (l.userId === null) this.ctx.throw(400, '不能删除系统默认布局');
    if (l.userId !== userId) this.ctx.throw(403, '无权删除此布局');
    await layout.destroy(); // CASCADE 会自动删除 widgets
  }

  /** 设为默认 */
  async setDefault(id: number, userId: number) {
    // 先取消用户当前默认
    await this.ctx.model.DashboardLayout.update(
      { isDefault: 0 },
      { where: { user_id: userId, is_default: 1 } } as any,
    );
    const layout = await this.ctx.model.DashboardLayout.findByPk(id);
    if (!layout) this.ctx.throw(404, '布局不存在');
    await layout.update({ isDefault: 1 });
    return layout;
  }

  /** 分享/取消分享 */
  async toggleShare(id: number, userId: number) {
    const layout = await this.ctx.model.DashboardLayout.findByPk(id);
    if (!layout) this.ctx.throw(404, '布局不存在');
    const l = layout as any;
    if (l.userId !== null && l.userId !== userId) {
      this.ctx.throw(403, '无权操作');
    }

    if (l.isShared) {
      await layout.update({ isShared: 0, shareToken: null });
      return { isShared: false, shareToken: null };
    }

    const token = crypto.randomBytes(32).toString('hex');
    await layout.update({ isShared: 1, shareToken: token });
    return { isShared: true, shareToken: token };
  }

  /** 通过分享Token获取(免登录) */
  async getSharedLayout(token: string) {
    const layout = await this.ctx.model.DashboardLayout.findOne({
      where: { share_token: token, is_shared: 1 } as any,
    });
    if (!layout) this.ctx.throw(404, '分享不存在或已失效');

    const widgets = await this.ctx.model.DashboardWidget.findAll({
      where: { layout_id: (layout as any).id },
      order: [['id', 'ASC']],
    });

    return { layout, widgets };
  }
}
