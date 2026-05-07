# 2026-03-25 — tool-box 项目目录结构重构（对齐 README 子项目规范）

## 对话日期

2026-03-25

---

## 需求背景

`packages/pc/tool-box` 项目的目录结构未遵循 Monorepo 根目录 `README.md` 中 **"子项目结构说明"** 的规范。原结构将所有源码放在 `src/` 子目录下，而 README 标准要求所有源码目录（`components/`、`layouts/`、`pages/`、`store/` 等）直接位于子项目根目录，并缺少若干必要文件。

---

## 技术方案

### 核心问题

| 问题 | 说明 |
|------|------|
| 源码目录层级错误 | 所有目录在 `src/` 下，应提升到项目根目录 |
| 缺少必要文件 | `Loading.tsx`、`config.ts`、`service.ts`、`assets/`、`pages/document.ejs`、`.umirc.preview.ts`、`.umirc.prod.ts` |
| 路径别名不对齐 | `@/*` 指向 `src/*`，应改为指向项目根目录 `./` |

### 调整策略

1. 用 `xcopy` 将 `src/` 下各目录复制到项目根目录
2. 更新 `tsconfig.json` 路径别名
3. 补全缺失文件
4. 将旧 `src/` 目录标记为废弃（`tsconfig.json` 中 `exclude` 排除）

---

## 实现详情

### 目录结构变更（调整前 → 调整后）

```
调整前：
packages/pc/tool-box/
├── .umirc.ts
├── .umirc.dev.ts
├── mock/
├── package.json
├── src/
│   ├── app.tsx
│   ├── components/
│   ├── layouts/
│   ├── models/        ← 废弃的 DVA models
│   ├── pages/
│   ├── services/
│   ├── store/
│   ├── styles/
│   └── utils/
└── tsconfig.json

调整后（符合 README 规范）：
packages/pc/tool-box/
├── .umirc.ts
├── .umirc.dev.ts
├── .umirc.preview.ts  ← 新增
├── .umirc.prod.ts     ← 新增
├── Loading.tsx        ← 新增
├── app.tsx            ← 从 src/ 提升
├── assets/            ← 新增
├── components/        ← 从 src/ 提升
├── config.ts          ← 新增
├── layouts/           ← 从 src/ 提升
├── mock/
├── package.json
├── pages/             ← 从 src/ 提升
│   └── document.ejs   ← 新增
├── service.ts         ← 新增（替代 src/services/api.ts）
├── services/          ← 保留（兼容旧引用）
├── src/               ← 保留但标记废弃
├── store/             ← 从 src/ 提升
├── styles/            ← 从 src/ 提升
├── tsconfig.json
└── utils/             ← 从 src/ 提升
```

### 新增文件说明

| 文件 | 说明 |
|------|------|
| `Loading.tsx` | 路由懒加载占位组件，在动态加载页面时显示 loading 状态 |
| `config.ts` | 构建配置，包含代码分割策略、CDN 配置等 |
| `service.ts` | API 请求层，统一封装 fetch 请求，替代 `src/services/api.ts` |
| `assets/` | 静态资源目录（图片、字体、图标），含 `.gitkeep` 占位 |
| `pages/document.ejs` | HTML 模板，包含主题防闪烁脚本和 iconfont 引用 |
| `.umirc.preview.ts` | 预发布环境配置（publicPath、proxy） |
| `.umirc.prod.ts` | 生产环境配置（CDN publicPath） |

### 关键配置修改

**`tsconfig.json`**：
```json
// 修改前
"paths": { "@/*": ["src/*"] },
"include": ["src", "mock", ".umirc.ts"],
"exclude": ["node_modules", "dist", ".umi"]

// 修改后
"paths": { "@/*": ["./*"] },
"include": ["app.tsx", "Loading.tsx", "config.ts", "service.ts",
            "components", "layouts", "pages", "store", "utils",
            "styles", "mock", ".umirc.ts", ...],
"exclude": ["node_modules", "dist", ".umi", "src", "services"]
```

**`.umirc.ts`**：
```ts
// 修改前
dynamicImport: {}

// 修改后
dynamicImport: {
  loading: '@/Loading',  // 指向根目录 Loading.tsx
}
```

**`layouts/BasicLayout/index.tsx`**：
```ts
// 修改前（相对路径）
import '../../styles/global.less';

// 修改后（@/ 别名）
import '@/styles/global.less';
```

---

## 问题与修复

### 问题 1：`xcopy` 命令路径带引号报错

**现象**：`xcopy "path" "dest" /E /I /Y` 报"无效路径"  
**原因**：Windows PowerShell 中 `xcopy` 不支持带引号的路径  
**修复**：去掉引号，直接使用不含空格的绝对路径

### 问题 2：`BasicLayout` 中 `../../styles/global.less` 路径失效

**现象**：目录提升后，`layouts/BasicLayout/index.tsx` 中的相对路径 `../../styles/global.less` 指向错误  
**原因**：原路径基于 `src/layouts/BasicLayout/` 计算，提升后层级变化  
**修复**：改为 `@/styles/global.less`（`@/` 现在指向项目根目录）

---

## 文件变更记录

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `Loading.tsx` | 新增 | 路由懒加载占位组件 |
| `app.tsx` | 新增（从 src/ 复制） | UmiJS 运行时配置 |
| `config.ts` | 新增 | 构建配置 |
| `service.ts` | 新增 | API 请求层 |
| `assets/.gitkeep` | 新增 | 静态资源目录占位 |
| `pages/document.ejs` | 新增 | HTML 模板 |
| `.umirc.preview.ts` | 新增 | 预发布环境配置 |
| `.umirc.prod.ts` | 新增 | 生产环境配置 |
| `components/` | 新增（从 src/ 复制） | 公共组件目录 |
| `layouts/` | 新增（从 src/ 复制） | 布局组件目录 |
| `pages/` | 新增（从 src/ 复制） | 页面目录 |
| `store/` | 新增（从 src/ 复制） | Zustand 状态管理 |
| `styles/` | 新增（从 src/ 复制） | 全局样式 |
| `utils/` | 新增（从 src/ 复制） | 工具函数 |
| `tsconfig.json` | 修改 | 更新 `@/*` 别名和 include/exclude |
| `.umirc.ts` | 修改 | 添加 `dynamicImport.loading` 配置 |
| `layouts/BasicLayout/index.tsx` | 修改 | 修复 styles 导入路径 |
| `src/app.tsx` | 修改 | 替换为废弃提示注释 |

---
