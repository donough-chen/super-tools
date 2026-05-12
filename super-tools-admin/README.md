# Super Tools 管理端

> UmiJS + Ant Design Pro + TypeScript 后台管理系统

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 应用框架 | UmiJS | 3.x |
| UI 框架 | Ant Design | 5.x |
| 状态管理 | DVA | 2.x |
| 视图层 | React + Hooks | 18.x |
| 语言 | TypeScript | 5.x |
| 样式 | Less + CSS Modules | — |
| HTTP 请求 | umi-request | — |
## 目录结构

```
super-tools-admin/
├── config/                          # UmiJS 配置
│   ├── routes/                      # 路由配置
│   │   ├── modules/auth.ts          # 认证模块路由
│   │   └── index.ts                 # 路由聚合入口
│   └── proxy.ts                     # 代理配置
├── src/
│   ├── components/                  # 公共组件
│   │   └── PageLoading/
│   ├── layouts/                     # 布局组件
│   │   ├── SecurityLayout.tsx       # 登录鉴权层
│   │   ├── BasicLayout.tsx          # 主框架布局
│   │   └── BasicLayout.less
│   ├── models/                      # DVA 状态
│   │   ├── global.ts                # 全局状态
│   │   └── user.ts                  # 用户状态
│   ├── pages/                       # 页面
│   │   ├── Login/                   # 登录页
│   │   ├── Register/                # 注册页
│   │   ├── Home/                    # 首页
│   │   ├── 403.tsx                  # 无权限页
│   │   └── 404.tsx                  # 404 页面
│   ├── services/                    # API 接口层
│   │   ├── auth.ts                  # 认证接口
│   │   └── index.ts
│   ├── utils/                       # 工具函数
│   │   ├── authority.ts             # 权限读写
│   │   ├── request.ts              # HTTP 封装
│   │   └── index.ts
│   ├── global.less                  # 全局样式
│   └── global.tsx                   # 全局初始化
├── .umirc.ts                        # UmiJS 主配置
├── tsconfig.json                    # TypeScript 配置
├── package.json                     # 依赖
└── typings.d.ts                     # 全局类型
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务
npm run dev

# 构建生产环境
npm run build:prod
```

## 后端 API 对接

后端服务运行在 `http://localhost:7001`，开发环境已配置代理。

### 认证接口

| 接口 | 方法 | 路径 | 认证 |
|------|------|------|------|
| 登录 | POST | /api/auth/login | ❌ |
| 注册 | POST | /api/auth/register | ❌ |
| 刷新 Token | POST | /api/auth/refresh | ❌ |
| 退出登录 | POST | /api/auth/logout | ✅ |
| 用户信息 | GET | /api/users/profile | ✅ |

## 多环境构建

| 环境 | 命令 | API 地址 |
|------|------|----------|
| 开发 | `npm run dev` | http://localhost:7001 |
| 生产 | `npm run build:prod` | https://api.example.com |
