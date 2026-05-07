import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, DATE, JSON: JSONTYPE } = DataTypes;

  const OauthClient = app.model.define('OauthClient', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    clientId: { type: STRING(64), allowNull: false, unique: true, field: 'client_id' },
    clientSecret: { type: STRING(255), allowNull: false, field: 'client_secret' },
    name: { type: STRING(100), allowNull: false },
    platform: { type: STRING(30), allowNull: false },
    redirectUris: { type: JSONTYPE, allowNull: true, field: 'redirect_uris' },
    allowedScopes: { type: JSONTYPE, allowNull: true, field: 'allowed_scopes' },
    grantTypes: { type: JSONTYPE, allowNull: true, field: 'grant_types' },
    accessTokenTtl: { type: INTEGER.UNSIGNED, defaultValue: 7200, field: 'access_token_ttl' },
    refreshTokenTtl: { type: INTEGER.UNSIGNED, defaultValue: 2592000, field: 'refresh_token_ttl' },
    status: { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 1 },
    description: { type: STRING(200), allowNull: true },
  }, {
    tableName: 'oauth_clients',
    timestamps: true,
    underscored: true,
  });

  return OauthClient;
};
