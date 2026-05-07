import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg';

export default (appInfo: EggAppInfo): PowerPartial<EggAppConfig> => {
  const config: PowerPartial<EggAppConfig> = {} as any;

  // 单元测试环境必须设置 keys，否则 CSRF 中间件报错
  config.keys = appInfo.name + '_secret_key_2026';

  // 关闭 CSRF（测试环境不需要）
  config.security = {
    csrf: {
      enable: false,
    },
  };

  // 测试数据库（与本地开发共用）
  config.sequelize = {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    database: 'superadmin_db',
    username: 'root',
    password: '123456',
    logging: false,
  } as any;

  // 测试 Redis
  config.redis = {
    client: {
      host: '127.0.0.1',
      port: 6379,
      password: '123456',
      db: 0,
    },
  } as any;

  // 关闭日志输出，减少测试噪音
  config.logger = {
    level: 'NONE',
    consoleLevel: 'NONE',
  };

  return config;
};
