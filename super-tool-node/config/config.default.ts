import * as dotenv from 'dotenv';
import * as path from 'path';
import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default (appInfo: EggAppInfo): PowerPartial<EggAppConfig> => {
  const config: PowerPartial<EggAppConfig> = {} as any;

  // 应用密钥（必须设置，否则 CSRF 中间件报错）
  config.keys = (appInfo.name || 'super-tool-node') + '_secret_key_2026';

  // 中间件配置（按顺序执行）
  // requestStartTime 必须放在最前面 — service.audit.log 依赖 ctx.state.requestStartTime
  config.middleware = ['requestStartTime', 'errorHandler', 'rateLimit'];

  // 安全配置
  config.security = {
    csrf: {
      enable: false, // API 服务关闭 CSRF
    },
    domainWhiteList: ['http://localhost:3000'],
  };

  // CORS 配置
  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    credentials: true,
  };

  // JWT 配置
  (config as any).jwt = {
    secret: process.env.JWT_SECRET || 'super-tool-jwt-secret-2026',
    expiresIn: '7d',
    refreshExpiresIn: '30d',
  };

  // MySQL Sequelize 配置
  config.sequelize = {
    dialect: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'superadmin_db',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    timezone: '+08:00',
    define: {
      underscored: true,
      freezeTableName: false,
      timestamps: true,
      paranoid: false,  // 各模型自行控制软删除，避免无 deleted_at 字段的表报错
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
  } as any;

  // Redis 配置
  config.redis = {
    client: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASS || '',
      db: 0,
    },
  } as any;

  // 日志配置
  config.logger = {
    dir: './logs',
    level: 'INFO',
    appLogName: `${appInfo.name}-web.log`,
    coreLogName: 'egg-web.log',
    agentLogName: 'egg-agent.log',
    errorLogName: 'common-error.log',
  };

  // 参数验证
  config.validate = {
    convert: true,
    widelyUndefined: true,
  };

  // 上传配置
  config.multipart = {
    mode: 'file',
    fileSize: '10mb',
    whitelist: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.xlsx'],
  };

  // 限流中间件配置
  (config as any).rateLimit = {
    max: 100,
    window: 60,
  };

  // 自定义业务配置
  (config as any).appConfig = {
    pageSize: 20,
    maxPageSize: 100,
    tokenBlacklistPrefix: 'token:blacklist:',
    rateLimitPrefix: 'rate:limit:',
  };

  // 微信配置（从环境变量读取）
  (config as any).wechat = {
    mpAppId: process.env.WECHAT_MP_APPID || '',
    mpSecret: process.env.WECHAT_MP_SECRET || '',
    h5AppId: process.env.WECHAT_H5_APPID || '',
    h5Secret: process.env.WECHAT_H5_SECRET || '',
    openAppId: process.env.WECHAT_OPEN_APPID || '',
    openSecret: process.env.WECHAT_OPEN_SECRET || '',
  };

  // 短信服务配置
  (config as any).sms = {
    provider: process.env.SMS_PROVIDER || 'mock',  // mock | tencent | aliyun
    // 腾讯云短信
    tencentSecretId: process.env.SMS_TENCENT_SECRET_ID || '',
    tencentSecretKey: process.env.SMS_TENCENT_SECRET_KEY || '',
    tencentSdkAppId: process.env.SMS_TENCENT_SDK_APP_ID || '',
    tencentSignName: process.env.SMS_TENCENT_SIGN_NAME || '',
    tencentTemplateId: process.env.SMS_TENCENT_TEMPLATE_ID || '',
  };

  // 验证码安全配置
  (config as any).verifyCode = {
    ttl: 300,            // 有效期 5 分钟
    sendInterval: 60,    // 发送间隔 60 秒
    dailyLimit: 10,      // 单号码每日限额
    ipHourlyLimit: 20,   // 单 IP 每小时限额
    verifyFailLimit: 5,  // 验证失败锁定次数
    verifyLockTtl: 1800, // 验证失败锁定 30 分钟
  };

  return config;
};
