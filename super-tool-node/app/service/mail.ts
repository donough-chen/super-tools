import BaseService from './base';
import * as nodemailer from 'nodemailer';

/**
 * 邮件发送服务
 *
 * 使用 nodemailer SMTP pool 连接池。
 * 启动时优先读 notification_channel_config 表的 SMTP 配置，
 * 如果表中无配置则回退到 config.notification.mail.transport。
 */
export default class MailService extends BaseService {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * 获取或创建 transporter（懒加载 + 连接池复用）
   */
  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    const mailConfig = (this.app.config as any).notification?.mail;
    let transportOpts: any = mailConfig?.transport;

    // 尝试从 DB 加载 SMTP 配置
    try {
      const dbConfig = await this.ctx.model.NotificationChannelConfig.findOne({
        where: { channel: 'email', provider: 'smtp', enabled: 1, isDefault: 1 },
      });
      if (dbConfig) {
        const cfg = (dbConfig as any).config;
        if (cfg?.host) {
          transportOpts = {
            host: cfg.host,
            port: cfg.port || 587,
            secure: cfg.secure || false,
            pool: cfg.pool !== false,
            maxConnections: cfg.maxConnections || 5,
            auth: cfg.auth_user ? { user: cfg.auth_user, pass: cfg.auth_pass } : undefined,
          };
        }
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[mail] failed to load SMTP config from DB: ${e.message}`);
    }

    if (!transportOpts?.host) {
      throw new Error('No SMTP configuration available');
    }

    this.transporter = nodemailer.createTransport(transportOpts);
    return this.transporter;
  }

  /**
   * 发送邮件
   */
  async send(opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string; accepted: string[] }> {
    const mailConfig = (this.app.config as any).notification?.mail;
    if (!mailConfig?.enabled) {
      throw new Error('Mail service is disabled');
    }

    const transporter = await this.getTransporter();
    const from = mailConfig.from || '"super-tools" <noreply@super-tools.local>';

    const startTime = Date.now();
    try {
      const info = await transporter.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text || opts.subject,
      });

      this.ctx.logger.info(`[mail] sent to=${opts.to} messageId=${info.messageId} cost=${Date.now() - startTime}ms`);
      return {
        messageId: info.messageId,
        accepted: info.accepted as string[],
      };
    } catch (e: any) {
      this.ctx.logger.error(`[mail] send failed to=${opts.to}: ${e.message} cost=${Date.now() - startTime}ms`);
      throw e;
    }
  }

  /**
   * 验证 SMTP 连接（admin "测试连接"按钮用）
   */
  async verify(): Promise<boolean> {
    const transporter = await this.getTransporter();
    return transporter.verify();
  }
}
