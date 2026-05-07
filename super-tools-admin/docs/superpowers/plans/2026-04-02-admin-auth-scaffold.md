# Super Tools 管理端架构搭建 & 注册登录功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 UmiJS + Ant Design Pro + TypeScript 后台管理端项目，实现注册登录功能模块并通过自动化测试验证

**Architecture:** 采用 UmiJS 3.x 框架 + DVA 状态管理 + umi-request 请求封装的分层架构。SecurityLayout 鉴权层 → BasicLayout 主框架布局。Service 层对接后端 Egg.js API（运行在 localhost:7001）。

**Tech Stack:** UmiJS 3.x, React 18, Ant Design 5, DVA 2.x, TypeScript 5, Less/CSS Modules, Jest/ts-jest

---

## 已完成任务

### Task 1: 项目初始化 ✅
- [x] 创建 package.json（完整依赖 + scripts）
- [x] 创建 tsconfig.json（TypeScript 配置）
- [x] 创建 .umirc.ts（多环境构建配置 + 代理 + DVA）
- [x] 创建 typings.d.ts（全局类型声明）
- [x] 创建 .gitignore

### Task 2: 基础配置层 ✅
- [x] config/routes/index.ts — 路由聚合入口
- [x] config/routes/modules/auth.ts — 认证模块路由
- [x] config/proxy.ts — 开发环境代理
- [x] src/utils/request.ts — HTTP 请求封装（Token 注入 + 错误处理）
- [x] src/utils/authority.ts — 权限信息读写工具
- [x] src/utils/index.ts — 通用工具函数

### Task 3: 布局与权限体系 ✅
- [x] src/layouts/SecurityLayout.tsx — 登录鉴权层
- [x] src/layouts/BasicLayout.tsx — 主框架布局
- [x] src/components/PageLoading — 页面加载组件

### Task 4: 注册登录功能模块 ✅
- [x] src/services/auth.ts — 认证 API（login/register/refresh/logout/profile）
- [x] src/models/user.ts — DVA User Model（状态管理）
- [x] src/models/global.ts — DVA Global Model
- [x] src/pages/Login — 登录页面
- [x] src/pages/Register — 注册页面
- [x] src/pages/Home — 首页
- [x] src/pages/403.tsx — 无权限页
- [x] src/pages/404.tsx — 404页面

### Task 5: 自动化测试 ✅
- [x] src/utils/__tests__/authority.test.ts — 权限工具单元测试（12项）
- [x] src/services/__tests__/auth.test.ts — 认证 API 参数构造测试（14项）
- [x] src/__tests__/auth-flow.test.ts — 注册登录完整流程集成测试（12项）
- [x] Jest 配置（ts-jest + moduleNameMapper + jsdom 环境）
- [x] **测试结果：3 Suites PASSED, 38 Tests PASSED**

## API 对接说明

后端服务：Egg.js (localhost:7001)

| 接口 | 方法 | 路径 | 请求体 |
|------|------|------|--------|
| 登录 | POST | /api/auth/login | { username, password, clientId, clientSecret } |
| 注册 | POST | /api/auth/register | { username, email, password, clientId, nickname? } |
| 刷新 | POST | /api/auth/refresh | { refreshToken } |
| 退出 | POST | /api/auth/logout | {} (需 Bearer Token) |
| 用户信息 | GET | /api/users/profile | (需 Bearer Token) |
