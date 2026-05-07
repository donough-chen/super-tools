# 通用跳转工具函数封装 & 路由跳转失效修复

## 对话日期

2026-03-25

## 需求背景

项目中涉及路由跳转的按钮全部失效，点击无响应。需要在 `utils/` 目录下封装一个通用的跳转工具函数，支持应用内路由、外部 URL、微信小程序等多种跳转类型，并统一替换项目中所有错误的跳转方式。

## 技术方案

### 问题根因分析

排查发现 `Header/index.tsx` 和 `ToolCard/index.tsx` 均使用了以下方式创建 history 实例：

```ts
import { createBrowserHistory } from 'history';
const history = createBrowserHistory();
history.push('/some-path');
```

**这是导致跳转失效的根本原因**：`createBrowserHistory()` 每次调用都会创建一个全新的 history 实例，与 umi 框架内部维护的 history 实例**不是同一个对象**。调用 `history.push()` 只改变了浏览器 URL，但 umi 的路由系统感知不到变化，页面不会重新渲染。

正确做法是使用 umi 提供的 history 单例：

```ts
import { history } from 'umi';
```

### 解决方案

在 `utils/navigator.ts` 中封装通用跳转工具，统一使用 `import { history } from 'umi'`，并扩展支持外部链接、微信小程序等多种跳转场景。

## 实现详情

### 新增文件：`utils/navigator.ts`

支持 4 种跳转类型（`NavigateType`）：

| 类型 | 说明 |
|------|------|
| `route`（默认） | 应用内 SPA 路由跳转，使用 umi history，无刷新 |
| `replace` | 替换当前历史记录，不产生新的历史条目 |
| `url` | 打开外部链接，支持 `_blank` / `_self` |
| `miniapp` | 微信小程序跳转，支持当前小程序页面或跳转其他小程序（需 wx JSSDK） |

导出的函数：

```ts
// 核心函数，支持完整配置项
navigate(options: NavigateOptions): void

// 快捷函数：应用内路由跳转
navigateTo(path: string, state?: Record<string, unknown>): void

// 快捷函数：返回上一页
navigateBack(delta?: number): void

// 快捷函数：打开外部链接
openUrl(url: string, openTarget?: '_blank' | '_self'): void
```

使用示例：

```ts
import { navigateTo, openUrl, navigate, navigateBack } from '@/utils/navigator';

// 应用内路由跳转
navigateTo('/settings');

// 外部链接（新标签页）
openUrl('https://example.com');

// 外部链接（当前页）
navigate({ target: 'https://example.com', type: 'url', openTarget: '_self' });

// 替换当前路由（不产生历史记录）
navigate({ target: '/home', type: 'replace' });

// 跳转微信小程序页面
navigate({ target: '/pages/index/index', type: 'miniapp' });

// 跳转其他微信小程序
navigate({ target: '/pages/index/index', type: 'miniapp', appId: 'wx1234567890' });

// 返回上一页
navigateBack();
```

## 问题与修复

### 问题：`createBrowserHistory` 与 umi history 实例不一致

- **现象**：点击任何跳转按钮，URL 栏地址变化，但页面内容不更新
- **原因**：`createBrowserHistory()` 创建的是独立实例，不受 umi 路由系统管理
- **修复**：统一改为 `import { history } from 'umi'`，通过 `navigator.ts` 封装后全局使用

### 问题：`Home/index.tsx` 使用 `useHistory` hook 方式不统一

- **现象**：与其他文件跳转方式不一致，维护成本高
- **修复**：移除 `useHistory` hook，统一改用 `navigateTo`

## 文件变更记录

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `utils/navigator.ts` | **新增** | 通用跳转工具函数，支持 route / replace / url / miniapp 四种类型 |
| `components/Header/index.tsx` | **修改** | 移除 `createBrowserHistory`，改用 `navigateTo` |
| `components/ToolCard/index.tsx` | **修改** | 移除 `createBrowserHistory`，改用 `navigateTo` |
| `pages/Home/index.tsx` | **修改** | 移除 `useHistory` hook，改用 `navigateTo` |

## 后续计划

- 如需支持 H5 内嵌 App 的原生跳转（如 JSBridge），可在 `NavigateType` 中扩展 `native` 类型
- 可考虑在 `navigateTo` 中集成 Tab 管理逻辑（`addTab`），进一步减少调用方的重复代码
