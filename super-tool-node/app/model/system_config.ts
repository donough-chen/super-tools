import { Application } from 'egg';

export default (app: Application) => {
  const { INTEGER, STRING, TEXT, DATE, BOOLEAN } = app.Sequelize;

  const SystemConfig = app.model.define('system_config', {
    id: {
      type: INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    group: {
      type: STRING(50),
      allowNull: false,
      comment: '配置分组:basic/sms/email/pay/oss/wechat等',
    },
    key: {
      type: STRING(100),
      allowNull: false,
      comment: '配置键',
    },
    value: {
      type: TEXT,
      allowNull: true,
      comment: '配置值',
    },
    type: {
      type: STRING(20),
      allowNull: false,
      defaultValue: 'string',
      comment: '值类型:string/number/boolean/json',
    },
    isSecret: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '是否敏感(加密存储,接口脱敏)',
      field: 'is_secret',
    },
    isPublic: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '是否前端可读',
      field: 'is_public',
    },
    description: {
      type: STRING(200),
      allowNull: true,
      comment: '配置说明',
    },
    sort: {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '排序',
    },
    createdAt: {
      type: DATE,
      allowNull: false,
      defaultValue: app.Sequelize.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DATE,
      allowNull: false,
      defaultValue: app.Sequelize.NOW,
      field: 'updated_at',
    },
  }, {
    tableName: 'system_configs',
    indexes: [
      {
        unique: true,
        fields: ['group', 'key'],
        name: 'uk_group_key',
      },
    ],
  });

  return SystemConfig;
};
