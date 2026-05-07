import { EggAppConfig, PowerPartial } from 'egg';

export default (): PowerPartial<EggAppConfig> => {
  const config: PowerPartial<EggAppConfig> = {} as any;

  // 生产环境配置
  config.sequelize = {
    dialect: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'superadmin_db',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
  } as any;

  config.logger = {
    level: 'INFO',
    consoleLevel: 'INFO',
  };

  return config;
};
