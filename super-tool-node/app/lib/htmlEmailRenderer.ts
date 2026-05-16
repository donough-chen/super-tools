/**
 * HTML 邮件包装器
 * 将纯文本/简单 HTML 内容包装为完整的邮件 HTML 模板
 */
export function wrapHtmlEmail(opts: {
  title: string;
  content: string;
  footerText?: string;
  unsubscribeUrl?: string;
}): string {
  const footer = opts.footerText || '此邮件由 super-tools 系统自动发送，请勿直接回复。';
  const unsubscribe = opts.unsubscribeUrl
    ? `<p style="margin-top:16px;"><a href="${opts.unsubscribeUrl}" style="color:#999;font-size:12px;">退订此类通知</a></p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#4f46e5;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:18px;">super-tools</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#333;font-size:16px;">${opts.title}</h2>
          <div style="color:#555;font-size:14px;line-height:1.6;">${opts.content}</div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;background:#fafafa;">
          <p style="margin:0;color:#999;font-size:12px;">${footer}</p>
          ${unsubscribe}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
