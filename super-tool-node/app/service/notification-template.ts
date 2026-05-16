import BaseService from './base';
import { renderTemplate } from '../lib/templateRenderer';
import type { EscapeMode } from '../lib/templateRenderer';

export interface RenderByCodeInput {
  /** 通知类型 code（如 BUSINESS_FEEDBACK_REPLY） */
  typeCode: string;
  /** 渠道 */
  channel: 'in_app' | 'email' | 'sms';
  /** 模板变量 */
  variables: Record<string, any>;
}

export interface RenderResult {
  title: string;
  content: string;
  templateId: number;
  templateVersion: number;
}

/**
 * 通知模板服务
 *
 * 职责：
 * 1. 按 typeCode + channel 查找已发布模板并渲染
 * 2. 创建草稿版本
 * 3. 发布版本（自动写入快照表）
 */
export default class NotificationTemplateService extends BaseService {

  /**
   * 按 typeCode + channel 查找已发布模板并渲染
   */
  async renderByCode(input: RenderByCodeInput): Promise<RenderResult> {
    const { ctx } = this;

    // 1. 查 type
    const type = await ctx.model.NotificationType.findOne({
      where: { code: input.typeCode, status: 1 },
    });
    if (!type) {
      ctx.throw(404, `通知类型 ${input.typeCode} 不存在或已停用`);
    }

    // 2. 查已发布模板（status=1）
    const template = await ctx.model.NotificationTemplate.findOne({
      where: { typeId: type.id, channel: input.channel, status: 1 },
    });
    if (!template) {
      ctx.throw(404, `通知类型 ${input.typeCode} 的 ${input.channel} 渠道没有已发布模板`);
    }

    // 3. 渲染
    const escapeMode: EscapeMode = input.channel === 'sms' ? 'none' : 'html';
    const titleResult = template.titleTemplate
      ? renderTemplate(template.titleTemplate, input.variables, { escape: escapeMode })
      : { result: '', missingVars: [], warnings: [] };
    const contentResult = renderTemplate(template.contentTemplate, input.variables, { escape: escapeMode });

    return {
      title: titleResult.result,
      content: contentResult.result,
      templateId: template.id,
      templateVersion: template.currentVersion,
    };
  }

  /**
   * 创建草稿（自动递增版本号）
   */
  async createDraft(input: {
    typeId: number;
    code: string;
    name: string;
    channel: 'in_app' | 'email' | 'sms';
    titleTemplate?: string;
    contentTemplate: string;
    extraConfig?: Record<string, any>;
    sampleVariables?: Record<string, any>;
    description?: string;
    operatorId: number;
  }) {
    const { ctx } = this;

    // 查找同 code + channel 最大版本号
    const last = await ctx.model.NotificationTemplate.findOne({
      where: { code: input.code, channel: input.channel },
      order: [['currentVersion', 'DESC']],
      paranoid: false,
    });
    const nextVersion = (last?.currentVersion ?? 0) + 1;

    return ctx.model.NotificationTemplate.create({
      typeId: input.typeId,
      code: input.code,
      name: input.name,
      channel: input.channel,
      titleTemplate: input.titleTemplate || null,
      contentTemplate: input.contentTemplate,
      extraConfig: input.extraConfig || null,
      sampleVariables: input.sampleVariables || null,
      currentVersion: nextVersion,
      status: 0, // 草稿
      description: input.description || null,
      createdBy: input.operatorId,
      updatedBy: input.operatorId,
    });
  }

  /**
   * 发布模板（将草稿置为已发布，旧版写入快照表）
   */
  async publishVersion(input: { templateId: number; operatorId: number; changeNote?: string }) {
    const { ctx } = this;
    const tpl = await ctx.model.NotificationTemplate.findByPk(input.templateId);
    if (!tpl) {
      ctx.throw(404, '模板不存在');
    }
    if (tpl.status === 1) {
      ctx.throw(400, '模板已处于发布状态');
    }

    await ctx.model.transaction(async (t: any) => {
      // 1. 旧 active 模板取消发布
      const oldActive = await ctx.model.NotificationTemplate.findOne({
        where: { typeId: tpl.typeId, channel: tpl.channel, status: 1 },
        transaction: t,
      });
      if (oldActive && oldActive.id !== tpl.id) {
        // 写入版本快照
        await ctx.model.NotificationTemplateVersion.create({
          templateId: oldActive.id,
          version: oldActive.currentVersion,
          titleTemplate: oldActive.titleTemplate,
          contentTemplate: oldActive.contentTemplate,
          extraConfig: oldActive.extraConfig,
          changeNote: `被 v${tpl.currentVersion} 替代`,
          publishedBy: input.operatorId,
        }, { transaction: t });
        await oldActive.update({ status: 2 }, { transaction: t }); // 已停用
      }

      // 2. 新模板置为已发布
      await tpl.update({ status: 1, updatedBy: input.operatorId }, { transaction: t });

      // 3. 写入当前版本快照
      await ctx.model.NotificationTemplateVersion.create({
        templateId: tpl.id,
        version: tpl.currentVersion,
        titleTemplate: tpl.titleTemplate,
        contentTemplate: tpl.contentTemplate,
        extraConfig: tpl.extraConfig,
        changeNote: input.changeNote || null,
        publishedBy: input.operatorId,
      }, { transaction: t });
    });

    return tpl.reload();
  }

  /**
   * P2.4: 回滚到指定历史版本
   */
  async rollbackToVersion(input: { templateId: number; versionId: number; operatorId: number }) {
    const { ctx } = this;
    const tpl = await ctx.model.NotificationTemplate.findByPk(input.templateId);
    if (!tpl) ctx.throw(404, '模板不存在');

    const version = await ctx.model.NotificationTemplateVersion.findByPk(input.versionId);
    if (!version) ctx.throw(404, '版本快照不存在');
    if ((version as any).templateId !== input.templateId) {
      ctx.throw(400, '版本快照不属于该模板');
    }

    const v = version as any;
    await ctx.model.transaction(async (t: any) => {
      // 先写当前版本的快照
      const currentTpl = tpl as any;
      await ctx.model.NotificationTemplateVersion.create({
        templateId: input.templateId,
        version: currentTpl.currentVersion,
        titleTemplate: currentTpl.titleTemplate,
        contentTemplate: currentTpl.contentTemplate,
        extraConfig: currentTpl.extraConfig,
        changeNote: `回滚前备份 (v${currentTpl.currentVersion})`,
        publishedBy: input.operatorId,
      }, { transaction: t });

      // 回滚模板内容
      const newVersion = currentTpl.currentVersion + 1;
      await tpl.update({
        titleTemplate: v.titleTemplate,
        contentTemplate: v.contentTemplate,
        extraConfig: v.extraConfig,
        currentVersion: newVersion,
        status: 1, // 发布
        updatedBy: input.operatorId,
      }, { transaction: t });

      // 写回滚版本快照
      await ctx.model.NotificationTemplateVersion.create({
        templateId: input.templateId,
        version: newVersion,
        titleTemplate: v.titleTemplate,
        contentTemplate: v.contentTemplate,
        extraConfig: v.extraConfig,
        changeNote: `回滚至 v${v.version}`,
        publishedBy: input.operatorId,
      }, { transaction: t });
    });

    return tpl.reload();
  }
}
