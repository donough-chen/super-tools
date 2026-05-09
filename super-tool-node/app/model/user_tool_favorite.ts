import { Application } from 'egg';
import { DataTypes, Optional } from 'sequelize';

export interface UserToolFavoriteAttributes {
  id: number;
  userId: number;
  toolId: number;
  toolCode: string;
  sort: number;
  favoritedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserToolFavoriteCreationAttributes
  extends Optional<UserToolFavoriteAttributes, 'id' | 'sort' | 'favoritedAt'> {}

export default (app: Application) => {
  const { BIGINT, STRING, INTEGER, DATE } = DataTypes;

  const UserToolFavorite = app.model.define('UserToolFavorite', {
    id:          { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    toolId:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'tool_id' },
    toolCode:    { type: STRING(60),      allowNull: false, field: 'tool_code' },
    sort:        { type: INTEGER,         allowNull: false, defaultValue: 0 },
    favoritedAt: { type: DATE,            allowNull: false, defaultValue: DataTypes.NOW, field: 'favorited_at' },
  }, {
    tableName: 'user_tool_favorites',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['user_id', 'tool_id'], name: 'uk_user_tool' },
      { fields: ['user_id', 'sort', 'id'], name: 'idx_user_sort' },
      { fields: ['user_id', 'favorited_at'], name: 'idx_user_favorited' },
      { fields: ['tool_id'], name: 'idx_tool' },
      { fields: ['tool_code'], name: 'idx_tool_code' },
    ],
  });

  (UserToolFavorite as any).associate = () => {
    UserToolFavorite.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    UserToolFavorite.belongsTo(app.model.Tool, { foreignKey: 'tool_id', as: 'tool' });
  };

  return UserToolFavorite;
};
