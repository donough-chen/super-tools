import { EggPlugin } from 'egg';

const plugin: EggPlugin = {
  sequelize: {
    enable: true,
    package: 'egg-sequelize',
  },
  redis: {
    enable: true,
    package: 'egg-redis',
  },
  jwt: {
    enable: true,
    package: 'egg-jwt',
  },
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  validate: {
    enable: true,
    package: 'egg-validate',
  },
  // 【新增】Socket.IO 实时通信
  io: {
    enable: true,
    package: 'egg-socket.io',
  },
};

// 本地开发环境若无数据库/Redis 可临时关闭:
// plugin.sequelize!.enable = false;
// plugin.redis!.enable = false;

export default plugin;
