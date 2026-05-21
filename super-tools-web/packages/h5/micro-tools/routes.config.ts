/**
 * micro-tools 路由统一配置（Single Source of Truth）
 *
 * - 被 `.umirc.dev.ts` / `.umirc.preview.ts` / `.umirc.prod.ts` 作为 umi 路由表使用
 * - 被 `constants/routes.ts` 读取以生成路由白名单，用于 `safeNavigate` 预检
 *
 * 约束：
 * 1. 本文件必须是**纯数据 + 纯类型**，禁止 import Node 专属 API（path/fs 等）
 *    或浏览器专属 API（window/document），以保证两端均可安全引用。
 * 2. 新增/下线页面只需修改本文件，无需再手动同步白名单。
 */

export interface MicroToolsRoute {
  /** 路径（严格以 / 开头） */
  path: string;
  /** 组件别名，形如 '@/pages/home' */
  component: string;
  /** 页面标题，可选 */
  title?: string;
  /** 子路由，可选 */
  routes?: MicroToolsRoute[];
  /** 其他 umi 支持的字段透传 */
  exact?: boolean;
}

/**
 * 业务页面路由（挂在布局 layout 下）
 *
 * 维护建议：
 * - 子路径放在父路径之前（umi 3 所有 route 默认 exact，排序不影响匹配；但保留清晰语义）
 * - 同一功能域用空行分组
 */
export const PAGE_ROUTES: MicroToolsRoute[] = [
  // ==================== 一级页面 ====================
  { path: '/', component: '@/pages/home', title: '首页' },
  { path: '/favorites', component: '@/pages/favorites', title: '收藏' },
  { path: '/featured', component: '@/pages/featured', title: '特色' },
  { path: '/sites', component: '@/pages/sites', title: '网站' },
  { path: '/mine', component: '@/pages/mine', title: '我的' },
  { path: '/404', component: '@/pages/404', title: '404' },

  // ==================== 二级页面 ====================
  { path: '/search', component: '@/pages/search', title: '搜索' },
  { path: '/login', component: '@/pages/login', title: '登录' },

  // 收藏相关二级页
  { path: '/favorites/reorder', component: '@/pages/favorites/reorder', title: '长按拖动排序' },

  // 设置相关（子路径在前以保持视觉顺序）
  { path: '/settings/binding', component: '@/pages/settings/binding', title: '账号绑定' },
  { path: '/settings/devices', component: '@/pages/settings/devices', title: '登录设备' },
  { path: '/settings/privacy', component: '@/pages/settings/privacy', title: '隐私设置' },
  { path: '/settings/notification', component: '@/pages/settings/notification', title: '通知设置' },
  { path: '/settings', component: '@/pages/settings', title: '设置' },

  { path: '/profile', component: '@/pages/profile', title: '个人信息' },
  { path: '/member', component: '@/pages/member', title: '会员' },
  { path: '/help', component: '@/pages/help', title: '使用帮助' },
  { path: '/about', component: '@/pages/about', title: '关于我们' },
  { path: '/notifications/detail/:id', component: '@/pages/notifications/detail/[id]', title: '消息详情' },
  { path: '/notifications', component: '@/pages/notifications', title: '消息' },

  // 反馈
  { path: '/feedback/detail/:id', component: '@/pages/feedback/detail/[id]', title: '反馈详情' },
  { path: '/feedback/history', component: '@/pages/feedback/history', title: '反馈历史' },
  { path: '/feedback', component: '@/pages/feedback', title: '意见反馈' },
];

/**
 * 完整 umi routes 结构（带布局包裹）
 * 直接交给 .umirc.*.ts 的 routes 字段
 */
export const UMI_ROUTES: MicroToolsRoute[] = [
  {
    exact: false,
    path: '/',
    component: '@/layouts',
    routes: PAGE_ROUTES,
  },
];

/**
 * 扁平化路径列表（递归收集 path）
 * 供运行时白名单使用
 */
function flattenPaths(routes: MicroToolsRoute[]): string[] {
  const acc: string[] = [];
  for (const r of routes) {
    if (r.component && r.component !== '@/layouts' && r.path) acc.push(r.path);
    if (r.routes?.length) acc.push(...flattenPaths(r.routes));
  }
  return acc;
}

/**
 * 所有业务页面路径（不含布局），已去重
 */
export const ALL_ROUTE_PATHS: readonly string[] = Array.from(
  new Set(flattenPaths(UMI_ROUTES)),
);
