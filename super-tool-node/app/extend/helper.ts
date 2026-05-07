import * as crypto from 'crypto';

export default {
  /**
   * MD5 加密
   */
  md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  },

  /**
   * 生成随机字符串
   */
  randomString(length: number = 16): string {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  },

  /**
   * 脱敏手机号
   */
  maskPhone(phone: string): string {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  },

  /**
   * 脱敏邮箱
   */
  maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    const maskedName = name.slice(0, 2) + '***';
    return `${maskedName}@${domain}`;
  },

  /**
   * 格式化日期
   */
  formatDate(
    date: Date,
    format: string = 'YYYY-MM-DD HH:mm:ss',
  ): string {
    const d = new Date(date);
    const map: Record<string, string> = {
      YYYY: d.getFullYear().toString(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0'),
    };
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (key) => map[key]);
  },
};
