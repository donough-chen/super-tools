# super-tools-web

基于 **UmiJS 3 + React 16 + TypeScript + Zustand** 的 Monorepo 前端工程，用于承载多个 H5 / PC / 其他小需求子项目，所有子项目共享同一套基础设施（AppSdk、请求封装、工具函数、公共组件等）。

---

## 目录结构

```
super-tools-web/
├── packages/
│   ├── shared/                # 公共共享层（所有子项目复用）
│   │   ├── appsdk/            # JSBridge 封装（AppSdk 单例）
│   │   ├── components/        # 公共 UI 组件（Loading 等）
│   │   ├── config/            # 公共 UmiJS 基础配置
│   │   ├── constants/         # 公共常量
│   │   ├── contexts/          # React Context（登录态等）
│   │   ├── hooks/             # 公共 Hooks
│   │   ├── layouts/           # 公共路由守卫层
│   │   └── utils/             # 工具函数（request、sig、report 等）
│   │
│   ├── template/              # 新项目标准模板（执行 yarn gen 时复制）
│   ├── h5/                    # H5 移动端子项目目录
│   ├── pc/                    # PC 端子项目目录
│   └── other/                 # 其他小需求子项目目录
│
└── scripts/
    ├── start.js               # 开发启动脚本
    ├── build.js               # 构建脚本
    └── create/                # 脚手架生成器（sao）
```

---

## 快速开始

### 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 20.x |
| Yarn | >= 1.22.x（建议使用 Yarn） |

### 安装依赖

MonoRepo的依赖分为两种，公共依赖、项目依赖。所有项目都可能用到的依赖，应安装到公共依赖项，项目自己的依赖安装到项目依赖。

- 公共依赖
  - `yarn add -W react` （将react安装到公共依赖）
- 项目依赖
  - `yarn workspace pc-xxx add react` （以 pc/xxx 项目安装react为例）
  - 项目名（`pc-xxx`）可从 packages/pc/xxx/package.json 文件查到
  - 参考文档: https://classic.yarnpkg.com/en/docs/cli/workspace/

```bash
yarn install
```

### 创建新子项目

```bash
yarn gen
```

按照交互式提示依次选择：
1. **项目分类**：`h5` / `pc` / `other`
2. **项目名称**：字母 + 中划线，如 `my-project`
3. **设计稿宽度**：`750px`（推荐）或 `375px`
4. **是否允许端外访问**：默认否（非 App 环境自动引导下载）

创建完成后，项目位于 `packages/{分类}/{项目名}/`。

### 启动开发服务器

```bash
# 格式：yarn start {分类}/{项目名}
yarn start h5/my-project
```

### 构建

```bash
# 构建生产包
yarn build-prod h5/my-project

# 构建预发布包
yarn build-preview h5/my-project

# 构建开发包
yarn build-dev h5/my-project

# 构建并分析产物体积
yarn build-analyze h5/my-project
```

---

## 子项目结构说明

每个子项目（以 `template` 为参考）的标准结构如下：

```
packages/h5/my-project/
├── .umirc.ts              # 基础配置（base、publicPath、shared 别名）
├── .umirc.dev.ts          # 开发环境配置（路由、代理）
├── .umirc.preview.ts      # 预发布环境配置
├── .umirc.prod.ts         # 生产环境配置（CDN publicPath）
├── Loading.tsx            # 路由懒加载占位组件
├── config.ts              # 构建配置（pxtorem、代码分割等）
├── service.ts             # API 请求层
├── assets/                # 静态资源（图片、字体等）
├── components/            # 项目私有组件
├── docs/                  # 本目录用于系统化记录每次与 AI Agent 对话的技术总结，积累项目开发知识资产，便于团队成员查阅和后续开发参考。
├── layouts/               # 路由布局（代理到 shared/layouts）
├── mock/                  # Mock 数据（开发环境）
├── pages/
│   ├── document.ejs       # HTML 模板
│   └── home/              # 首页
│       ├── index.tsx
│       └── index.less
└── store/                 # Zustand 状态管理
    └── home.ts
```

---

## 状态管理（Zustand）

本项目使用 **Zustand + immer** 替代 DVA（已停止维护），写法更简洁，TypeScript 支持更完善。

```ts
// store/home.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useHomeStore = create<HomeState & HomeActions>()(
  immer(set => ({
    data: {},
    loading: false,

    fetchData: async () => {
      set(state => { state.loading = true; });
      const result = await getHomeData();
      set(state => {
        state.data = result;
        state.loading = false;
      });
    },
  })),
);

// 在组件中使用
const { data, loading, fetchData } = useHomeStore();
```

---

## 公共 shared 层

所有子项目通过别名 `@/` 引用 `shared` 层：

| 别名 | 对应路径 | 说明 |
|------|---------|------|
| `@/utils` | `shared/utils` | 工具函数（request、sig、report 等） |
| `@/appsdk` | `shared/appsdk` | JSBridge 封装 |
| `@/hooks` | `shared/hooks` | 公共 Hooks |
| `@/constants` | `shared/constants` | 公共常量 |
| `@/contexts` | `shared/contexts` | React Context |
| `@/components` | `shared/components` | 公共 UI 组件 |

### 常用 API

```ts
// 网络请求
import { request } from '@/utils';
const { code, data } = await request.get('/api/xxx', { params });
const { code, data } = await request.post('/api/xxx', { data: { ... } });

// AppSdk（JSBridge）
import appsdk from '@/appsdk';
const { userId, token } = appsdk.getAppParams();
await appsdk.openNewPage('https://...');

// 公共 Hooks
import { useStayReport, useAsync, useAppReady } from '@/hooks';
useStayReport(10001);                          // 页面停留时长上报
const { data, loading } = useAsync(() => fetchData(), [id]);  // 异步数据加载
useAppReady(() => { /* App 就绪后执行 */ });   // App 就绪回调

// 登录态 Context
import { useAuth } from '@/contexts';
const { userInfo, isLoggedIn } = useAuth();
```

---

## 代码规范

```bash
# 格式化代码
yarn prettier

# ESLint 检查
yarn lint

# ESLint 自动修复
yarn lint:fix
```

提交代码时会自动触发 `lint-staged`，对暂存文件执行 ESLint 修复。

---

## 环境说明

| 环境 | UMI_ENV | publicPath | 说明 |
|------|---------|-----------|------|
| 开发 | `dev` | `/` | 本地开发，含 Mock 数据 |
| 预发布 | `preview` | `/fepreview/{分类}/{项目名}/` | 测试环境 |
| 生产 | `prod` | CDN 地址 | 正式上线 |

---

## H5 rem 适配

- 设计稿 **750px** → `rootValue: 20`（1rem = 20px，即 `750 / 37.5 = 20`）
- 设计稿 **375px** → `rootValue: 10`
- 使用 `postcss-pxtorem` 自动转换，开发时直接按设计稿 px 值书写即可

---

## 常见问题

**Q: 为什么必须用 Yarn 而不是 npm？**
A: 项目使用 Yarn Workspaces 管理 Monorepo，npm 不支持此特性。

**Q: 如何在子项目中添加私有依赖？**
A: 在对应子项目的 `package.json` 中添加，然后在根目录执行 `yarn install`。

**Q: 如何新增公共组件？**
A: 在 `packages/shared/components/` 下新建目录，通过 `@/components/xxx` 引用。

**Q: 端外访问白名单如何配置？**
A: 编辑 `packages/shared/utils/openPages.ts`，将允许端外访问的页面路径加入数组。
