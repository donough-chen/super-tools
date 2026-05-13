# Super Tool Node 后台服务

## 技术栈

- **运行时**: Node.js 18+ LTS
- **框架**: Egg.js 3.x + TypeScript 5.x
- **数据库**: MySQL 8.0 (Sequelize ORM)
- **缓存**: Redis 7.x (ioredis)
- **认证**: JWT + SSO 多端会话管理

## 快速开始

```bash
npm install                          # 安装依赖
cp .env.example .env                 # 配置环境变量
npm run db:cli                       # 交互式执行 database/init.sql
npm run dev                          # 启动开发服务 http://localhost:7001
```

## API 接口

### 认证（/api/auth）
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/auth/login | 登录（需 clientId+clientSecret） | 否 |
| POST | /api/auth/register | 注册 | 否 |
| POST | /api/auth/refresh | 刷新 Token | 否 |
| POST | /api/auth/send-code | 发送验证码 | 否 |
| POST | /api/auth/logout | 登出 | 是 |
| GET | /api/auth/sessions | 当前用户所有会话 | 是 |
| DELETE | /api/auth/sessions/:id | 踢掉会话 | 是 |

### 用户（/api/users）
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/users/profile | 当前用户信息 | 是 |
| PUT | /api/users/password | 修改密码 | 是 |
| GET | /api/users/addresses | 地址列表 | 是 |
| POST | /api/users/addresses | 添加地址 | 是 |
| PUT | /api/users/addresses/:id | 更新地址 | 是 |
| DELETE | /api/users/addresses/:id | 删除地址 | 是 |
| GET | /api/users | 用户列表（管理） | 是 |
| GET | /api/users/:id | 用户详情 | 是 |
| POST | /api/users | 创建用户 | 是 |
| PUT | /api/users/:id | 更新用户 | 是 |
| DELETE | /api/users/:id | 删除用户 | 是 |

### 角色管理（/api/admin/roles）
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/admin/roles | 角色列表 | 是 |
| GET | /api/admin/roles/:id | 角色详情（含权限） | 是 |
| POST | /api/admin/roles | 创建角色 | 是 |
| PUT | /api/admin/roles/:id | 更新角色 | 是 |
| DELETE | /api/admin/roles/:id | 删除角色 | 是 |
| PUT | /api/admin/roles/:id/permissions | 分配权限 | 是 |

### 权限管理（/api/admin/permissions）
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/admin/permissions/tree | 权限树 | 是 |
| GET | /api/admin/permissions/:id | 权限详情 | 是 |
| POST | /api/admin/permissions | 创建权限 | 是 |
| PUT | /api/admin/permissions/:id | 更新权限 | 是 |
| DELETE | /api/admin/permissions/:id | 删除权限 | 是 |

### Dashboard
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/admin/dashboard | 统计数据 | 是 |

## 命令

```bash
npm run dev         # 开发模式启动
npm run db:cli      # 数据库交互式CLI
npm run build       # 编译 TypeScript
npm start           # 生产模式启动
npm stop            # 停止服务
```
## 测试
现已删掉掉测试脚本命令，防止旧数据污染数据库。如果需要测试时，请手动添加以下命令到 package.json 中：

```json
"scripts": {
    "test": "cross-env EGG_SERVER_ENV=unittest egg-bin test --ts",
    "test:api": "cross-env EGG_SERVER_ENV=unittest egg-bin test --ts test/api/**/*.test.ts",
    "test:e2e": "cross-env EGG_SERVER_ENV=unittest egg-bin test --ts test/e2e/**/*.test.ts",
    "test:auth": "cross-env EGG_SERVER_ENV=unittest egg-bin test --ts test/api/auth.test.ts",
    "api": "node scripts/api-test-interactive.js"
}
```