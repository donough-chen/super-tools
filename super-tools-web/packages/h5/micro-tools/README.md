# micro-tools — H5 多页面微应用

> **super-tools-web** Monorepo 架构中的 H5 子项目，提供移动端工具集合、网站导航、收藏管理等核心功能。

## 📋 项目概览

| 字段 | 值 |
|------|---|
| **包名** | `h5-micro-tools` |
| **技术栈** | React 16 + UmiJS 3 + Zustand + TypeScript |
| **样式方案** | Less + CSS Variables + postcss-pxtorem (750px 设计稿) |
| **状态管理** | Zustand + immer 中间件 |
| **路由** | UmiJS 配置式路由 + 路由级代码分割 |
| **目标环境** | Chrome 49+ / iOS 10+ |
| **设计稿** | 750px 宽度，rootValue=20 (1rem = 20px) |

## 🏗️ 架构位置

```
super-tools-web/
├── packages/shared/          ← 公共共享层（utils/hooks/components/appsdk/layouts）
└── packages/h5/micro-tools/  ← 本项目
```

本项目通过 `alias` 机制引用 shared 层资源：

| 别名 | 实际路径 |
|------|---------|
| `@/utils` | `packages/shared/utils` |
| `@/hooks` | `packages/shared/hooks` |
| `@/components` | `packages/shared/components` |
| `@/appsdk` | `packages/shared/appsdk` |
| `@/constants` | `packages/shared/constants` |
| `@/contexts` | `packages/shared/contexts` |
| `@/assets` | `packages/h5/micro-tools/assets` |

## 📁 目录结构

```
packages/h5/micro-tools/
├── .umirc.ts                 # UmiJS 基础配置（alias、base、publicPath）
├── .umirc.dev.ts             # 开发环境（路由、代理、Mock）
├── .umirc.preview.ts         # 预发布环境配置
├── .umirc.prod.ts            # 生产环境配置（CDN publicPath）
├── config.ts                 # 共享构建配置（targets、pxtorem、分包）
├── Loading.tsx               # 路由懒加载占位组件
├── package.json              # Workspace 包标识
├── service.ts                # API 请求层（统一接口出口）
├── README.md                 # 本文件
│
├── assets/                   # 静态资源
│   └── variables.less        # CSS 全局变量（设计 token）
│
├── components/               # 项目私有公共组件
│   ├── index.ts              # 统一导出
│   ├── AppHeader/            # 头部导航组件（毛玻璃 + 按钮组 + rightSlot 自定义按钮）
│   ├── AppTabs/              # Tab 切换组件（双 Tab / 多 Tab）
│   ├── AppTabBar/            # 底部导航栏组件（悬浮 / 平铺）
│   ├── AppModal/             # 底部弹起弹窗组件
│   ├── KeepAlive/            # 页面缓存组件
│   ├── SendCodeButton/       # 验证码发送按钮（含全局倒计时持久化）
│   ├── Switch/               # 开关组件（隐私/通知/设备推送页共用）
│   ├── SignCalendar/         # 签到日历周视图
│   ├── TaskCard/             # 任务卡片组件
│   ├── MallItemCard/         # 商城商品卡片
│   └── Countdown/            # 倒计时组件
│
├── constants/                # 项目常量
│   ├── index.ts              # TabBar 配置、模式选项、排序选项
│   ├── oauth.ts              # OAuth 客户端、Token 存储 key、白名单、强鉴权路由
│   └── options.ts            # 性别 / 语言 / 时区选项常量
│
├── types/                    # 项目类型定义
│   └── auth.ts               # UserInfo / ProfileExtra / BindStatus / DeviceInfo / SessionInfo / MemberInfo 等
│
├── utils/                    # 项目工具
│   ├── authRequest.ts        # 鉴权拦截器（Bearer Token 注入 + 401 自动刷新）
│   ├── errorMap.ts           # 后端错误码 → 友好文案映射
│   └── toast.ts              # 轻量 Toast + 剪贴板复制
│
├── hooks/                    # 项目 Hooks
│   ├── useSwipe.ts           # 通用左右滑动手势 Hook
│   ├── useCountdown.ts       # 通用倒计时 Hook
│   ├── useAuthGuard.ts       # 路由守卫 Hook（强鉴权路由跳转）
│   └── useDeviceInfo.ts      # 当前 H5 设备信息（含稳定指纹）
│
├── service/                  # 模块化 Service 层（替代原 service.ts 大文件）
│   ├── index.ts              # 统一出口
│   ├── common.ts             # 公共业务接口（banner / tool / favorite / featured / site）
│   ├── auth.ts               # 认证接口（11 个 V1 端点）
│   ├── user.ts               # 用户资料接口
│   ├── member.ts             # 会员接口（含等级/权益/积分流水/备用签到）
│   ├── device.ts             # 设备 / 会话接口
│   ├── sign.ts               # 签到接口（GET status / POST sign）
│   ├── task.ts               # 任务中心接口（GET tasks / POST claim）
│   └── pointsMall.ts         # 积分商城接口（含字段适配器）
│
├── store/                    # Zustand 状态管理
│   ├── index.ts              # 统一导出
│   ├── global.ts             # 全局设置（主题色、导航模式、列表模式）
│   ├── home.ts               # 首页数据（Banner、分类工具列表）
│   ├── favorites.ts          # 收藏数据
│   ├── sites.ts              # 网站数据（分类、排序）
│   ├── user.ts               # 用户登录态 / 资料 / 绑定 / 密码（重构版）
│   ├── member.ts             # 会员等级信息（5 分钟缓存 + 升级 Toast 检测）
│   ├── device.ts             # 设备 / 会话管理
│   ├── sendCode.ts           # 验证码倒计时全局状态（sessionStorage 持久化）
│   ├── sign.ts               # 签到状态 + 提交签到
│   ├── task.ts               # 任务列表 + 领取奖励
│   ├── pointsLog.ts          # 积分流水（分页+筛选）
│   └── pointsMall.ts         # 积分商城（商品/订单/兑换）
│
├── layouts/                  # 路由布局（接入鉴权拦截器 + 路由守卫 + 设备注册 + KeepAlive）
│   └── index.tsx
│
├── mock/                     # Mock 数据（开发环境）
│   └── index.ts              # 全部接口 Mock 覆盖（含 22+ 个 auth/user/device/member 接口）
│
├── pages/                    # 页面组件
│   ├── document.ejs          # HTML 模板
│   ├── home/                 # 一级 — 首页
│   ├── favorites/            # 一级 — 收藏页
│   ├── featured/             # 一级 — 特色页
│   ├── sites/                # 一级 — 网站页
│   ├── mine/                 # 一级 — 我的页（接入会员等级徽标）
│   ├── search/               # 二级 — 搜索页
│   ├── login/                # 二级 — 登录注册页（4 子表单：手机/密码/手机注册/邮箱注册）
│   │   └── components/       # LoginByPhone / LoginByPassword / RegisterByPhone / RegisterByEmail
│   ├── settings/             # 二级 — 设置中心（3 大分组）
│   │   ├── binding/          # 三级 — 账号绑定管理
│   │   ├── devices/          # 三级 — 登录设备管理（设备 / 会话两 Tab）
│   │   ├── privacy/          # 三级 — 隐私设置
│   │   └── notification/     # 三级 — 通知设置
│   ├── profile/              # 二级 — 个人信息（5 卡片完整编辑能力）
│   ├── member/               # 二级 — 会员中心（积分成长体系总入口）
│   │   ├── subscribe/        # 三级 — 订阅会员（原 /member 订阅逻辑迁移至此）
│   │   ├── level/            # 三级 — 会员等级详情
│   │   ├── points-logs/      # 三级 — 积分明细
│   │   ├── cashier/          # 三级 — 收银台
│   │   └── orders/           # 三级 — 订阅订单
│   ├── tasks/                # 二级 — 任务中心（4 Tab：新手/日常/成长/活动）
│   ├── points-mall/          # 二级 — 积分商城
│   │   ├── category/         # 三级 — 分类商品列表
│   │   ├── items/            # 三级 — 商品详情 + 兑换确认
│   │   ├── exchange-success/ # 三级 — 兑换成功页
│   │   └── orders/           # 三级 — 兑换记录
│   ├── help/                 # 二级 — 使用帮助页
│   └── about/                # 二级 — 关于我们页
│
└── docs/                     # 技术文档
    ├── H5多页面微应用需求文档.md
    ├── 组件使用文档.md
    ├── 状态管理文档.md
    ├── 页面开发指南.md
    ├── API接口文档.md
    ├── 开发规范与常见问题.md
    ├── demands/
    │   └── 2026-04-30-登录注册与用户中心重构需求文档.md  ← 本次重构需求文档
    └── plans/
        └── 2026-04-30-登录注册与用户中心重构实施计划.md  ← 本次重构实施计划
```

## 🚀 快速开始

### 安装依赖

```bash
# 在 Monorepo 根目录
yarn install
```

### 开发

```bash
# 启动开发服务器（含 Mock 数据 + 热更新）
yarn start h5/micro-tools
```

开发环境访问地址：`http://localhost:8000/fe/h5/micro-tools/`

### 构建

```bash
# 生产环境构建
yarn build-prod h5/micro-tools

# 预发布环境构建
yarn build-preview h5/micro-tools

# 构建并分析产物体积
yarn build-analyze h5/micro-tools
```

### 添加依赖

```bash
# 添加项目私有依赖
yarn workspace h5-micro-tools add some-package
```

## 🗺️ 路由总览

### 一级页面（含底部导航栏，KeepAlive 缓存）

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 Home | 搜索框 + Banner 轮播 + 工具分类列表 |
| `/favorites` | 收藏 Favorites | 用户收藏工具列表 |
| `/featured` | 特色 Featured | 双 Tab（特色功能 / 会员专属） |
| `/sites` | 网站 Sites | 多 Tab 分类 + 网站列表 |
| `/mine` | 我的 Mine | 用户信息 + 功能菜单 |

### 二级页面（含返回按钮，无底部导航栏）

| 路由 | 页面 | 说明 | 鉴权 |
|------|------|------|------|
| `/search` | 搜索 | 工具关键词搜索 | — |
| `/login` | 登录 | 多 Tab 登录注册（手机号 / 账号密码 / 邮箱注册） | — |
| `/favorites/reorder` | 收藏排序 | 长按拖拽调整收藏顺序 | 强 |
| `/settings` | 设置 | 账号安全 / 偏好设置 / 显示偏好（3 大分组） | 强 |
| `/settings/binding` | 账号绑定 | 手机号 / 邮箱 / 微信 绑定与解绑 | 强 |
| `/settings/devices` | 登录设备 | 设备 / 会话两 Tab 管理 | 强 |
| `/settings/privacy` | 隐私设置 | 显示手机号 / 邮箱 / 在线状态（防抖保存） | 强 |
| `/settings/notification` | 通知设置 | 推送 / 短信 / 邮件 + 当前设备推送 | 强 |
| `/profile` | 个人信息 | 头像 / 基础资料 / 扩展资料 / 会员卡 / 邀请码 | 强 |
| `/member` | 会员中心 | 积分成长体系总入口（签到/等级/积分） | 强 |
| `/member/level` | 会员等级 | 等级详情与进度 | 强 |
| `/member/points-logs` | 积分明细 | 积分流水记录 | 强 |
| `/member/subscribe` | 订阅会员 | 会员套餐订阅 | 强 |
| `/tasks` | 任务中心 | 新手/日常/成长/活动任务 | 强 |
| `/points-mall` | 积分商城 | 商品首页（Banner/热门/分类） | — |
| `/points-mall/category/:code` | 分类商品 | 按分类浏览商品 | — |
| `/points-mall/items/:id` | 商品详情 | 商品详情 + 兑换确认 | — |
| `/points-mall/exchange-success` | 兑换成功 | 兑换成功页 | — |
| `/points-mall/orders` | 兑换记录 | 我的兑换订单 | 强 |
| `/help` | 使用帮助 | FAQ 问答列表 | — |
| `/about` | 关于我们 | 应用信息与外链 | — |

> **强鉴权路由**：`/profile` / `/settings` / `/favorites` / `/member` 及其子路由，
> 未登录访问会自动跳转到 `/login?redirect=<原路径>`。

### URL 规则

| 环境 | 格式 | 示例 |
|------|------|------|
| 开发 | `http://localhost:8000/fe/h5/micro-tools/{path}` | `/fe/h5/micro-tools/favorites` |
| 预发布 | `https://test.xxx.com/fepreview/h5/micro-tools/{path}` | `/fepreview/h5/micro-tools/` |
| 生产 | `https://xxx.com/fe/h5/micro-tools/{path}` | `/fe/h5/micro-tools/mine` |

## 🧩 核心组件

| 组件 | 用途 | 关键特性 |
|------|------|---------|
| `<AppHeader />` | 头部导航 | 毛玻璃 / 标题 + 按钮组 / 返回按钮 / **rightSlot 自定义按钮** |
| `<AppTabs />` | Tab 切换 | 双 Tab 模式 / 多 Tab 滚动模式 / 指示块平移动画 |
| `<AppTabBar />` | 底部导航栏 | 悬浮 / 平铺两种模式 / 跟随主题色 |
| `<AppModal />` | 底部弹窗 | 底部弹起动画 / 下滑关闭 / 多内容类型 |
| `<KeepAlive />` | 页面缓存 | 一级页面切换保持滚动位置与 UI 状态 |
| `<SendCodeButton />` | 验证码发送 | 全局倒计时持久化 / 自动校验 / 失败错误码映射 |
| `<Switch />` | 开关 | 纯 CSS 实现 / 隐私 / 通知 / 设备推送共用 |
| `<SignCalendar />` | 签到日历 | 周视图日历 / 签到状态标记 / 连签天数显示 |
| `<TaskCard />` | 任务卡片 | 任务状态 / 进度条 / 奖励积分 / 操作按钮 |
| `<MallItemCard />` | 商城商品卡片 | 商品图片 / 积分价格 / 标签 / 库存状态 |
| `<Countdown />` | 倒计时 | 天/时/分/秒 / 到期自动回调 |

> 📖 详细组件 API 请参阅 [docs/组件使用文档.md](docs/组件使用文档.md)

## 📦 状态管理

采用 **Zustand + immer** 按业务模块拆分 Store：

| Store | 文件 | 职责 |
|-------|------|------|
| `useGlobalStore` | `global.ts` | 全局设置（主题色、导航模式、列表模式），localStorage 持久化 |
| `useHomeStore` | `home.ts` | 首页 Banner + 工具分类列表 |
| `useFavoritesStore` | `favorites.ts` | 收藏工具列表与增删操作 |
| `useSitesStore` | `sites.ts` | 网站分类 Tab + 网站列表 + 排序 |
| `useUserStore` | `user.ts` | 登录态 / 用户资料（基础+扩展）/ Token 管理 / 账号绑定 / 修改密码 / 当前会话 ID |
| `useMemberStore` | `member.ts` | 会员等级信息（5 分钟缓存 + 升级 Toast 检测） |
| `useDeviceStore` | `device.ts` | 设备列表 / 会话列表 / 推送开关 / 踢下线 |
| `useSendCodeStore` | `sendCode.ts` | 验证码倒计时全局状态（sessionStorage 持久化） |
| `useSignStore` | `sign.ts` | 签到状态 + 提交签到（积分成长体系） |
| `useTaskStore` | `task.ts` | 任务列表 + 领取奖励（积分成长体系） |
| `usePointsLogStore` | `pointsLog.ts` | 积分流水（分页+筛选）（积分成长体系） |
| `usePointsMallStore` | `pointsMall.ts` | 积分商城（商品/订单/兑换）（积分成长体系） |

> 📖 详细 Store 设计请参阅 [docs/状态管理文档.md](docs/状态管理文档.md)

## 🎨 设计规范

### CSS 变量体系

所有设计值统一定义在 `assets/variables.less`，通过 CSS 变量引用：

- **布局高度**：`--header-height` (88px) / `--tabs-height` (80px) / `--tabbar-height` (100px)
- **主题色**：`--primary-color` (默认 `#1677ff`，支持动态修改)
- **文字色**：`--text-primary` / `--text-secondary` / `--text-tertiary`
- **间距**：`--spacing-xs` ~ `--spacing-xxl` (4px ~ 48px)
- **圆角**：`--border-radius-sm` ~ `--border-radius-round` (8px ~ 999px)
- **动画**：`--transition-fast` / `--transition-normal` / `--transition-bounce`
- **毛玻璃**：`--glass-blur` (10px) + `--glass-bg`

### H5 适配方案

- 设计稿宽度 750px，`postcss-pxtorem` 自动转换
- `rootValue: 20`（1rem = 20px），代码中直接写 px
- iOS 底部安全区：`env(safe-area-inset-bottom)`

## 🎨 设计 Token 与换肤机制

所有样式遵循「**CSS 变量优先、禁用硬编码**」原则，统一在 `assets/variables.less` 定义设计 Token。

### 字号 Token（750px 设计稿）

| Token | 值 | 用途 |
|---|---|---|
| `--font-size-xxs` | 16px | 徽标、极小标签 |
| `--font-size-xs` | 18px | 辅助说明、计数器、协议文字 |
| `--font-size-sm` | 20px | 副标题、次要按钮、图标型提示 |
| `--font-size-md` | 24px | **正文默认**（输入框、行标签、普通按钮） |
| `--font-size-lg` | 26px | **页面/卡片标题**（AppHeader 标题、弹窗标题） |
| `--font-size-xl` | 28px | 昵称、重要数值（会员等级名、邀请码） |
| `--font-size-xxl` | 32px | Logo 文字、特大数值 |
| `--font-size-title` | 36px | 启动页大标题、设备图标 emoji |

> **禁止**直接写 `font-size: 28px`；必须使用 `font-size: var(--font-size-xl)`。
> 唯一例外：`assets/iconfont.less` 中的字体图标尺寸类。

### 主题色派生变量

`store/global.ts` 的 `setThemeColor` 在切换主题色时，会**同步写入 4 个派生 CSS 变量**，另 3 个通过 `rgba(var(--primary-color-rgb), x)` 自动继承：

| 变量 | 含义 | 写入方式 |
|---|---|---|
| `--primary-color` | 主色 hex | setThemeColor 直接写入 |
| `--primary-color-rgb` | 主色 "R, G, B" 数字串 | setThemeColor 解析 hex 后写入 |
| `--primary-color-hover` | hover 态（主色 + 白 18%） | setThemeColor 线性混合算得 |
| `--primary-color-active` | active 态（主色 + 黑 12%） | setThemeColor 线性混合算得 |
| `--primary-color-light` | 10% 透明（选中态背景） | variables.less 声明 `rgba(var(--primary-color-rgb), 0.1)` |
| `--primary-color-lighter` | 6% 透明（卡片底色） | 同上 0.06 |
| `--primary-color-shadow` | 20% 透明（focus 光晕） | 同上 0.2 |

**所有组件请使用这些变量**，禁止 `rgba(22, 119, 255, ...)` 之类的硬编码色，否则切肤会失效。

### 其它 Token 速查

- **文字**：`--text-primary` / `-secondary` / `-tertiary` / `-quaternary` / `-placeholder` / `-light` / `-danger` / `-success` / `-warning`
- **背景**：`--bg-page` / `-white` / `-glass` / `-mask`
- **间距**：`--spacing-xs`(4) / `-sm`(8) / `-md`(16) / `-lg`(24) / `-xl`(32) / `-xxl`(48)
- **圆角**：`--border-radius-sm`(8) / `-md`(12) / `-lg`(16) / `-xl`(24) / `-round`(999)
- **阴影**：`--shadow-sm` / `-md` / `-lg` / `-tabbar`
- **动画**：`--transition-fast`(.15s) / `-normal`(.3s) / `-slow`(.5s) / `-bounce`

### 溢出防护约定

所有「标题/名称/值」文本区域都应：
- 单行截断：`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- 容器需 `min-width: 0`（flex 子项默认 `min-width: auto` 会撑破布局）
- 多行文本：`word-break: break-all` 或 `-webkit-line-clamp`

---

## 🔐 认证与会员体系

本项目已对接后端全平台认证系统 + 会员等级体系（详见 [docs/demands/2026-04-30-登录注册与用户中心重构需求文档.md](docs/demands/2026-04-30-登录注册与用户中心重构需求文档.md)）。

### 鉴权机制

- **双 Token**：accessToken（2 小时）+ refreshToken（7 天）
- **拦截器自动注入**：`utils/authRequest.ts` 通过 `customRequest.interceptors` 自动给业务接口注入 `Authorization: Bearer <token>`
- **401 自动刷新**：捕获 401 后排队刷新 token 并重放原请求；刷新失败跳 `/login?redirect=<原路径>`
- **白名单**：登录 / 注册 / 验证码等接口不注入 token；详见 `constants/oauth.ts`
- **路由守卫**：`useAuthGuard` 在 layout 中守护 `/profile` / `/settings` / `/favorites` / `/member` 强鉴权路由

### 登录方式

| 方式 | 接口 | 入口 |
|---|---|---|
| 手机号 + 验证码（登录即注册） | `POST /api/auth/phone-login` | `/login`（默认） |
| 账号密码（用户名/邮箱/手机号） | `POST /api/auth/login` | `/login` 切到「账号密码」 |
| 邮箱 + 密码注册 | `POST /api/auth/register` | `/login` 切到「注册 → 邮箱」 |

### Mock 测试账号

开发环境（Mock 启用时）：
- **账号密码**：`admin` / `Admin@123`
- **手机号验证码**：任意手机号 + 验证码 `123456`（`13800138000` 视为老用户，其他视为新用户）
- **绑定 / 修改密码**：使用同上验证码与原密码





## 🔗 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [docs/H5多页面微应用需求文档.md](docs/H5多页面微应用需求文档.md) | 完整技术需求规格 |
| 组件文档 | [docs/组件使用文档.md](docs/组件使用文档.md) | 公共组件 API 与用法 |
| 状态管理 | [docs/状态管理文档.md](docs/状态管理文档.md) | Zustand Store 设计详解 |
| 页面指南 | [docs/页面开发指南.md](docs/页面开发指南.md) | 新增页面的开发流程 |
| API 文档 | [docs/API接口文档.md](docs/API接口文档.md) | 接口定义与数据模型 |
| 开发规范 | [docs/开发规范与常见问题.md](docs/开发规范与常见问题.md) | 编码规范与 FAQ |
| **登录注册重构需求** | [docs/demands/2026-04-30-登录注册与用户中心重构需求文档.md](docs/demands/2026-04-30-登录注册与用户中心重构需求文档.md) | 本次重构详细需求规格 |
| **登录注册重构实施计划** | [docs/plans/2026-04-30-登录注册与用户中心重构实施计划.md](docs/plans/2026-04-30-登录注册与用户中心重构实施计划.md) | 本次重构 36 Task 实施计划 |

## 📝 维护指引

### 新增页面

1. 在 `pages/` 下创建页面目录（`index.tsx` + `index.less`）
2. 在 `.umirc.dev.ts` / `.umirc.preview.ts` / `.umirc.prod.ts` 中注册路由
3. 如为一级页面，需在 `constants/index.ts` 的 `TAB_BAR_ITEMS` 中添加导航项
4. 如需独立状态，在 `store/` 中创建对应 Store 并从 `store/index.ts` 导出

### 新增组件

1. 在 `components/` 下创建组件目录（`index.tsx` + `*.less`）
2. 从 `components/index.ts` 统一导出组件和类型

### 新增接口

1. 在 `service/` 对应业务模块中添加接口函数（auth/user/member/device/common）
2. 如需新增类型，在 `types/auth.ts` 定义并导出
3. 在 `mock/index.ts` 中添加对应 Mock（注意 `code: 200` 而非 `0`）
4. 如该接口需要鉴权 → 拦截器自动注入 Token；如属公开接口 → 在 `constants/oauth.ts` 的 `AUTH_WHITELIST` 中注册
5. 更新 [docs/API接口文档.md](docs/API接口文档.md)

### 修改设计 Token

1. 在 `assets/variables.less` 中修改 CSS 变量
2. 如涉及主题色相关变量，同步检查 `store/global.ts` 中的 `setThemeColor` 逻辑
