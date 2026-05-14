# Dashboard Phase 1: 数据概览 + 业务分析 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Dashboard 数据概览页和业务分析页，对接已有 Stats API 并新增留存率/活跃时段/运营效率等接口。

**Architecture:** 后端在现有 StatsService 上扩展新方法，新增 DashboardController。前端替换占位页为完整图表页面，使用 @ant-design/charts 渲染。WebSocket 实时推送在 Phase 3 中实现，本阶段使用轮询。

**Tech Stack:** Egg.js + Sequelize + MySQL (后端) | UmiJS + Ant Design 5 + @ant-design/charts + DVA (前端)

---

## File Structure

### 后端新增/修改

| 文件 | 操作 | 职责 |
|------|------|------|
| `super-tool-node/app/service/stats.ts` | 修改 | 新增 userRetention/activeHours/toolCategory/operationEfficiency/userGrowth 方法 |
| `super-tool-node/app/service/dashboard.ts` | 新增 | systemStatus 方法 |
| `super-tool-node/app/controller/admin/dashboard.ts` | 修改 | 新增 systemStatus 路由处理 |
| `super-tool-node/app/controller/admin/stats.ts` | 修改 | 新增 5 个路由处理方法 |
| `super-tool-node/app/router.ts` | 修改 | 注册新路由 |

### 前端新增/修改

| 文件 | 操作 | 职责 |
|------|------|------|
| `super-tools-admin/package.json` | 修改 | 添加 @ant-design/charts 依赖 |
| `super-tools-admin/src/services/dashboard.ts` | 新增 | Dashboard API 请求封装 |
| `super-tools-admin/src/pages/Dashboard/Overview/index.tsx` | 新增 | 概览页主组件 |
| `super-tools-admin/src/pages/Dashboard/Overview/index.less` | 新增 | 概览页样式 |
| `super-tools-admin/src/pages/Dashboard/Overview/components/KPICards.tsx` | 新增 | KPI 卡片组件 |
| `super-tools-admin/src/pages/Dashboard/Overview/components/TrendChart.tsx` | 新增 | 趋势图表组件 |
| `super-tools-admin/src/pages/Dashboard/Overview/components/SystemStatus.tsx` | 新增 | 系统状态面板 |
| `super-tools-admin/src/pages/Dashboard/Analytics/index.tsx` | 新增 | 业务分析页主组件 |
| `super-tools-admin/src/pages/Dashboard/Analytics/index.less` | 新增 | 业务分析页样式 |
| `super-tools-admin/src/pages/Dashboard/Analytics/components/UserBehavior.tsx` | 新增 | 用户行为分析 Tab |
| `super-tools-admin/src/pages/Dashboard/Analytics/components/ToolUsage.tsx` | 新增 | 工具使用统计 Tab |
| `super-tools-admin/src/pages/Dashboard/Analytics/components/OperationEfficiency.tsx` | 新增 | 运营效率 Tab |
| `super-tools-admin/config/routes/modules/dashboard.ts` | 新增 | Dashboard 路由模块 |
| `super-tools-admin/config/routes/index.ts` | 修改 | 引入 dashboard 路由 |

---

## Task 1: 安装前端图表依赖

**Files:**
- Modify: `super-tools-admin/package.json`

- [ ] **Step 1: 安装 @ant-design/charts**

```bash
cd super-tools-admin
npm install @ant-design/charts --save
```

- [ ] **Step 2: 验证安装成功**

```bash
node -e "require('@ant-design/charts'); console.log('OK')"
```

Expected: 输出 `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps(admin): add @ant-design/charts for dashboard"
```

---

## Task 2: 后端 — Dashboard Service (systemStatus)

**Files:**
- Create: `super-tool-node/app/service/dashboard.ts`

- [ ] **Step 1: 创建 DashboardService**

```typescript
// super-tool-node/app/service/dashboard.ts
import { Service } from 'egg';

export default class DashboardService extends Service {
  /**
   * 获取系统运行状态
   */
  async getSystemStatus() {
    const now = Date.now();
    const oneHourAgo = new Date(now - 3600000);

    // MySQL 状态检测
    let mysqlStatus = { status: 'ok' as 'ok' | 'error', latency: 0 };
    try {
      const start = Date.now();
      await this.ctx.model.User.sequelize!.authenticate();
      mysqlStatus.latency = Date.now() - start;
    } catch {
      mysqlStatus = { status: 'error', latency: -1 };
    }

    // Redis 状态检测
    let redisStatus = { status: 'ok' as 'ok' | 'error', latency: 0 };
    try {
      const start = Date.now();
      await this.app.redis.ping();
      redisStatus.latency = Date.now() - start;
    } catch {
      redisStatus = { status: 'error', latency: -1 };
    }

    // API 统计 (最近1小时)
    const { Op } = require('sequelize');
    const [totalRequests, errorRequests] = await Promise.all([
      this.ctx.model.ApiLog.count({
        where: { created_at: { [Op.gte]: oneHourAgo } },
      }),
      this.ctx.model.ApiLog.count({
        where: { created_at: { [Op.gte]: oneHourAgo }, status: { [Op.gte]: 400 } },
      }),
    ]);

    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    // 响应时间百分位数 (从 api_logs 获取)
    const responseTimeStats = await this.ctx.model.ApiLog.findAll({
      attributes: [
        [this.ctx.model.ApiLog.sequelize!.fn('AVG',
          this.ctx.model.ApiLog.sequelize!.col('response_time')), 'avg'],
      ],
      where: { created_at: { [Op.gte]: oneHourAgo } },
      raw: true,
    }) as any[];

    const avgResponseTime = responseTimeStats[0]?.avg || 0;

    // 活跃会话数
    const activeSessionCount = await this.ctx.model.UserSession.count({
      where: { is_active: 1 },
    });

    return {
      mysql: mysqlStatus,
      redis: redisStatus,
      api: {
        totalRequests,
        errorRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
      },
      activeSessionCount,
    };
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
cd super-tool-node
npx tsc --noEmit app/service/dashboard.ts
```

Expected: 无编译错误

- [ ] **Step 3: Commit**

```bash
git add app/service/dashboard.ts
git commit -m "feat(node): add DashboardService with systemStatus"
```

---

## Task 3: 后端 — Stats Service 扩展 (5个新方法)

**Files:**
- Modify: `super-tool-node/app/service/stats.ts`

- [ ] **Step 1: 在 StatsService 中新增 getUserRetention 方法**

在 `stats.ts` 文件的 `exportCsv` 方法之后，class 结束之前添加：

```typescript
  /**
   * 用户留存率
   * @param startDate 起始日期 YYYY-MM-DD
   * @param endDate 结束日期 YYYY-MM-DD
   */
  async getUserRetention(startDate: string, endDate: string) {
    const { Op } = require('sequelize');
    const sequelize = this.ctx.model.User.sequelize!;

    // 获取每日注册用户的 N 日留存
    const retentionDays = [1, 3, 7, 14, 30];
    const sql = `
      SELECT
        DATE(u.created_at) as cohort_date,
        COUNT(DISTINCT u.id) as total_users,
        ${retentionDays.map(d => `
          COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM login_logs ll
            WHERE ll.user_id = u.id
            AND DATE(ll.created_at) = DATE_ADD(DATE(u.created_at), INTERVAL ${d} DAY)
            AND ll.status = 1
          ) THEN u.id END) as day_${d}_retained
        `).join(',')}
      FROM users u
      WHERE DATE(u.created_at) BETWEEN :startDate AND :endDate
      GROUP BY DATE(u.created_at)
      ORDER BY cohort_date DESC
    `;

    const results = await sequelize.query(sql, {
      replacements: { startDate, endDate },
      type: sequelize.QueryTypes.SELECT,
    }) as any[];

    return {
      cohorts: results.map(row => ({
        date: row.cohort_date,
        totalUsers: Number(row.total_users),
        retention: {
          day1: row.total_users > 0 ? Math.round((row.day_1_retained / row.total_users) * 10000) / 100 : 0,
          day3: row.total_users > 0 ? Math.round((row.day_3_retained / row.total_users) * 10000) / 100 : 0,
          day7: row.total_users > 0 ? Math.round((row.day_7_retained / row.total_users) * 10000) / 100 : 0,
          day14: row.total_users > 0 ? Math.round((row.day_14_retained / row.total_users) * 10000) / 100 : 0,
          day30: row.total_users > 0 ? Math.round((row.day_30_retained / row.total_users) * 10000) / 100 : 0,
        },
      })),
    };
  }

  /**
   * 活跃时段分布 (24h × 7d 热力图数据)
   * @param days 统计天数 (7 或 30)
   */
  async getActiveHours(days: number = 7) {
    const sequelize = this.ctx.model.User.sequelize!;
    const since = new Date(Date.now() - days * 86400000);

    const sql = `
      SELECT
        DAYOFWEEK(created_at) as day_of_week,
        HOUR(created_at) as hour,
        COUNT(DISTINCT user_id) as active_users
      FROM login_logs
      WHERE created_at >= :since AND status = 1
      GROUP BY DAYOFWEEK(created_at), HOUR(created_at)
      ORDER BY day_of_week, hour
    `;

    const results = await sequelize.query(sql, {
      replacements: { since },
      type: sequelize.QueryTypes.SELECT,
    }) as any[];

    return {
      data: results.map(row => ({
        dayOfWeek: Number(row.day_of_week),
        hour: Number(row.hour),
        activeUsers: Number(row.active_users),
      })),
    };
  }

  /**
   * 工具分类使用统计
   */
  async getToolCategory(startDate?: string, endDate?: string) {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange(startDate, endDate);

    const sql = `
      SELECT
        tc.name as category_name,
        tc.code as category_code,
        COUNT(*) as usage_count
      FROM api_logs al
      JOIN tools t ON al.path LIKE CONCAT('/api/%tools/', t.code, '%')
      JOIN tool_categories tc ON t.category_id = tc.id
      WHERE al.created_at BETWEEN :startTime AND :endTime
      GROUP BY tc.id, tc.name, tc.code
      ORDER BY usage_count DESC
    `;

    const results = await sequelize.query(sql, {
      replacements: { startTime, endTime },
      type: sequelize.QueryTypes.SELECT,
    }) as any[];

    const total = results.reduce((sum: number, r: any) => sum + Number(r.usage_count), 0);

    return {
      categories: results.map(row => ({
        name: row.category_name,
        code: row.category_code,
        usageCount: Number(row.usage_count),
        percentage: total > 0 ? Math.round((Number(row.usage_count) / total) * 10000) / 100 : 0,
      })),
    };
  }

  /**
   * 运营效率指标
   */
  async getOperationEfficiency(startDate?: string, endDate?: string) {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange(startDate, endDate);
    const { Op } = require('sequelize');

    // 1. 反馈平均响应时间 (按周)
    const feedbackResponseSql = `
      SELECT
        YEARWEEK(created_at, 1) as week,
        MIN(DATE(created_at)) as week_start,
        AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_hours
      FROM feedbacks
      WHERE status >= 1
        AND created_at BETWEEN :startTime AND :endTime
      GROUP BY YEARWEEK(created_at, 1)
      ORDER BY week
    `;
    const feedbackResponse = await sequelize.query(feedbackResponseSql, {
      replacements: { startTime, endTime },
      type: sequelize.QueryTypes.SELECT,
    }) as any[];

    // 2. 反馈完成率
    const [totalFeedback, completedFeedback] = await Promise.all([
      this.ctx.model.Feedback.count({
        where: { created_at: { [Op.between]: [startTime, endTime] } },
      }),
      this.ctx.model.Feedback.count({
        where: { status: 3, created_at: { [Op.between]: [startTime, endTime] } },
      }),
    ]);

    // 3. 会员转化漏斗
    const funnelSql = `
      SELECT
        (SELECT COUNT(*) FROM users WHERE status = 1) as registered,
        (SELECT COUNT(DISTINCT user_id) FROM login_logs WHERE status = 1) as logged_in,
        (SELECT COUNT(DISTINCT user_id) FROM api_logs WHERE path LIKE '/api/%tools%') as used_tool,
        (SELECT COUNT(*) FROM user_members WHERE is_paid = 1) as paid_member
    `;
    const funnelResult = await sequelize.query(funnelSql, {
      type: sequelize.QueryTypes.SELECT,
    }) as any[];

    return {
      feedbackResponse: feedbackResponse.map(r => ({
        week: r.week_start,
        avgHours: Math.round(Number(r.avg_hours) * 10) / 10,
      })),
      feedbackCompletion: {
        total: totalFeedback,
        completed: completedFeedback,
        rate: totalFeedback > 0 ? Math.round((completedFeedback / totalFeedback) * 10000) / 100 : 0,
      },
      memberConversion: {
        registered: Number(funnelResult[0]?.registered || 0),
        loggedIn: Number(funnelResult[0]?.logged_in || 0),
        usedTool: Number(funnelResult[0]?.used_tool || 0),
        paidMember: Number(funnelResult[0]?.paid_member || 0),
      },
    };
  }

  /**
   * 用户增长 (按注册渠道分组)
   */
  async getUserGrowth(startDate?: string, endDate?: string, granularity: Granularity = 'day') {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange(startDate, endDate);
    const bucketFormat = this._bucketFormat(granularity);

    const sql = `
      SELECT
        DATE_FORMAT(created_at, '${bucketFormat}') as date,
        COALESCE(register_source, 'unknown') as source,
        COUNT(*) as count
      FROM users
      WHERE created_at BETWEEN :startTime AND :endTime
      GROUP BY DATE_FORMAT(created_at, '${bucketFormat}'), register_source
      ORDER BY date, source
    `;

    const results = await sequelize.query(sql, {
      replacements: { startTime, endTime },
      type: sequelize.QueryTypes.SELECT,
    }) as any[];

    return {
      data: results.map(row => ({
        date: row.date,
        source: row.source,
        count: Number(row.count),
      })),
    };
  }
```

- [ ] **Step 2: 验证编译通过**

```bash
cd super-tool-node
npx tsc --noEmit
```

Expected: 无编译错误

- [ ] **Step 3: Commit**

```bash
git add app/service/stats.ts
git commit -m "feat(node): extend StatsService with retention/activeHours/toolCategory/efficiency/growth"
```

---

## Task 4: 后端 — Controller 和路由注册

**Files:**
- Modify: `super-tool-node/app/controller/admin/stats.ts`
- Modify: `super-tool-node/app/controller/admin/dashboard.ts`
- Modify: `super-tool-node/app/router.ts`

- [ ] **Step 1: 扩展 AdminStatsController**

在 `app/controller/admin/stats.ts` 的 `exportCsv` 方法之后添加：

```typescript
  /** GET /api/admin/stats/user-retention */
  async userRetention() {
    const { startDate, endDate } = this.ctx.query as any;
    if (!startDate || !endDate) {
      this.ctx.status = 422;
      return this.success(null, '缺少 startDate 或 endDate 参数');
    }
    const data = await this.service.stats.getUserRetention(startDate, endDate);
    this.success(data);
  }

  /** GET /api/admin/stats/active-hours */
  async activeHours() {
    const days = parseInt(this.ctx.query.days as string) || 7;
    const data = await this.service.stats.getActiveHours(days);
    this.success(data);
  }

  /** GET /api/admin/stats/tool-category */
  async toolCategory() {
    const { startDate, endDate } = this.ctx.query as any;
    const data = await this.service.stats.getToolCategory(startDate, endDate);
    this.success(data);
  }

  /** GET /api/admin/stats/operation-efficiency */
  async operationEfficiency() {
    const { startDate, endDate } = this.ctx.query as any;
    const data = await this.service.stats.getOperationEfficiency(startDate, endDate);
    this.success(data);
  }

  /** GET /api/admin/stats/user-growth */
  async userGrowth() {
    const { startDate, endDate, granularity } = this.ctx.query as any;
    const data = await this.service.stats.getUserGrowth(startDate, endDate, granularity || 'day');
    this.success(data);
  }
```

- [ ] **Step 2: 扩展 AdminDashboardController**

将 `app/controller/admin/dashboard.ts` 扩展为：

```typescript
import BaseController from '../base';

export default class AdminDashboardController extends BaseController {
  /** GET /api/admin/dashboard */
  async index() {
    const userCount = await this.ctx.model.User.count();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { Op } = require('sequelize');
    const todayLoginCount = await this.ctx.model.LoginLog.count({
      where: { status: 1, created_at: { [Op.gte]: todayStart } },
    });
    const activeSessionCount = await this.ctx.model.UserSession.count({
      where: { is_active: 1 },
    });
    const roleCount = await this.ctx.model.Role.count();
    this.success({ userCount, todayLoginCount, activeSessionCount, roleCount });
  }

  /** GET /api/admin/dashboard/system-status */
  async systemStatus() {
    const data = await this.service.dashboard.getSystemStatus();
    this.success(data);
  }
}
```

- [ ] **Step 3: 在 router.ts 注册新路由**

在 `app/router.ts` 的 stats 路由区域（约 `router.get('/api/admin/stats/export'` 之后）添加：

```typescript
  // Dashboard - 新增
  router.get('/api/admin/dashboard/system-status', auth, checkPermission('dashboard:overview'), controller.admin.dashboard.systemStatus);

  // Stats - 新增
  router.get('/api/admin/stats/user-retention', auth, checkPermission('stats:overview'), controller.admin.stats.userRetention);
  router.get('/api/admin/stats/active-hours', auth, checkPermission('stats:overview'), controller.admin.stats.activeHours);
  router.get('/api/admin/stats/tool-category', auth, checkPermission('stats:overview'), controller.admin.stats.toolCategory);
  router.get('/api/admin/stats/operation-efficiency', auth, checkPermission('stats:overview'), controller.admin.stats.operationEfficiency);
  router.get('/api/admin/stats/user-growth', auth, checkPermission('stats:overview'), controller.admin.stats.userGrowth);
```

- [ ] **Step 4: 验证编译通过**

```bash
cd super-tool-node
npx tsc --noEmit
```

Expected: 无编译错误

- [ ] **Step 5: Commit**

```bash
git add app/controller/admin/stats.ts app/controller/admin/dashboard.ts app/router.ts
git commit -m "feat(node): register dashboard/stats new routes and controllers"
```

---

## Task 5: 前端 — Dashboard API Service

**Files:**
- Create: `super-tools-admin/src/services/dashboard.ts`

- [ ] **Step 1: 创建 dashboard service**

```typescript
// super-tools-admin/src/services/dashboard.ts
import request from '@/utils/request';

// ====== 概览 ======
export async function getStatsOverview() {
  return request('/api/admin/stats/overview');
}

export async function getSystemStatus() {
  return request('/api/admin/dashboard/system-status');
}

export async function getStatsTrend(params: {
  metric: 'user-register' | 'user-login' | 'feedback-submit' | 'tool-access';
  granularity?: 'day' | 'week' | 'month';
  startTime?: string;
  endTime?: string;
}) {
  return request('/api/admin/stats/trend', { params });
}

// ====== 业务分析 ======
export async function getUserRetention(params: { startDate: string; endDate: string }) {
  return request('/api/admin/stats/user-retention', { params });
}

export async function getActiveHours(params: { days?: number }) {
  return request('/api/admin/stats/active-hours', { params });
}

export async function getToolUsage(params?: { startTime?: string; endTime?: string; limit?: number }) {
  return request('/api/admin/stats/tool-usage', { params });
}

export async function getToolCategory(params?: { startDate?: string; endDate?: string }) {
  return request('/api/admin/stats/tool-category', { params });
}

export async function getOperationEfficiency(params?: { startDate?: string; endDate?: string }) {
  return request('/api/admin/stats/operation-efficiency', { params });
}

export async function getUserGrowth(params?: {
  startDate?: string; endDate?: string; granularity?: 'day' | 'week' | 'month';
}) {
  return request('/api/admin/stats/user-growth', { params });
}

export async function getUserActive(params?: { startTime?: string; endTime?: string }) {
  return request('/api/admin/stats/user-active', { params });
}
```

- [ ] **Step 2: Commit**

```bash
cd super-tools-admin
git add src/services/dashboard.ts
git commit -m "feat(admin): add dashboard API service layer"
```

---

## Task 6: 前端 — 路由配置

**Files:**
- Create: `super-tools-admin/config/routes/modules/dashboard.ts`
- Modify: `super-tools-admin/config/routes/index.ts`

- [ ] **Step 1: 创建 dashboard 路由模块**

```typescript
// super-tools-admin/config/routes/modules/dashboard.ts
export default [
  {
    path: '/dashboard',
    name: '数据看板',
    icon: 'DashboardOutlined',
    routes: [
      {
        path: '/dashboard/overview',
        name: '数据概览',
        component: './Dashboard/Overview',
      },
      {
        path: '/dashboard/analytics',
        name: '业务分析',
        component: './Dashboard/Analytics',
      },
    ],
  },
];
```

- [ ] **Step 2: 在 routes/index.ts 中引入**

在 `config/routes/index.ts` 中添加 import 并插入路由数组。找到现有路由导入区域，添加：

```typescript
import dashboardRoutes from './modules/dashboard';
```

然后在路由数组中（BasicLayout 的 routes 内，放在 `/home` 之后）插入：

```typescript
...dashboardRoutes,
```

- [ ] **Step 3: Commit**

```bash
git add config/routes/modules/dashboard.ts config/routes/index.ts
git commit -m "feat(admin): add dashboard route configuration"
```

---

## Task 7: 前端 — 数据概览页 KPI 卡片组件

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Overview/components/KPICards.tsx`

- [ ] **Step 1: 实现 KPICards 组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Overview/components/KPICards.tsx
import React from 'react';
import { Card, Col, Row, Statistic, Tooltip } from 'antd';
import {
  UserOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  ToolOutlined,
  CrownOutlined,
  MessageOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { TinyArea } from '@ant-design/charts';

interface KPIData {
  userCount: number;
  activeUserCount: number;
  todayNewUserCount: number;
  toolCount: number;
  paidMemberCount?: number;
  pendingFeedbackCount: number;
  // 对比数据
  userCountChange?: number;
  activeUserChange?: number;
  newUserChange?: number;
  toolUsageChange?: number;
}

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

const KPICards: React.FC<KPICardsProps> = ({ data, loading }) => {
  const cards = [
    {
      title: '用户总数',
      value: data?.userCount || 0,
      icon: <UserOutlined />,
      change: data?.userCountChange,
      color: '#1890ff',
    },
    {
      title: '今日活跃',
      value: data?.activeUserCount || 0,
      icon: <ThunderboltOutlined />,
      change: data?.activeUserChange,
      color: '#52c41a',
    },
    {
      title: '今日新增',
      value: data?.todayNewUserCount || 0,
      icon: <UserAddOutlined />,
      change: data?.newUserChange,
      color: '#722ed1',
    },
    {
      title: '工具使用',
      value: data?.toolCount || 0,
      icon: <ToolOutlined />,
      change: data?.toolUsageChange,
      color: '#fa8c16',
    },
    {
      title: '付费会员',
      value: data?.paidMemberCount || 0,
      icon: <CrownOutlined />,
      color: '#eb2f96',
    },
    {
      title: '待处理反馈',
      value: data?.pendingFeedbackCount || 0,
      icon: <MessageOutlined />,
      color: '#f5222d',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col xs={12} sm={8} md={8} lg={4} key={card.title}>
          <Card loading={loading} size="small" bordered={false} hoverable>
            <Statistic
              title={
                <span>
                  <span style={{ color: card.color, marginRight: 8 }}>{card.icon}</span>
                  {card.title}
                </span>
              }
              value={card.value}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              suffix={
                card.change !== undefined ? (
                  <Tooltip title="较昨日同期">
                    <span
                      style={{
                        fontSize: 14,
                        color: card.change >= 0 ? '#52c41a' : '#f5222d',
                        marginLeft: 8,
                      }}
                    >
                      {card.change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {Math.abs(card.change)}%
                    </span>
                  </Tooltip>
                ) : null
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default KPICards;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard/Overview/components/KPICards.tsx
git commit -m "feat(admin): add KPICards component for dashboard overview"
```

---

## Task 8: 前端 — 趋势图表组件

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Overview/components/TrendChart.tsx`

- [ ] **Step 1: 实现 TrendChart 组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Overview/components/TrendChart.tsx
import React, { useState, useEffect } from 'react';
import { Card, Radio, Spin } from 'antd';
import { DualAxes } from '@ant-design/charts';
import { getStatsTrend } from '@/services/dashboard';

type Granularity = 'day' | 'week' | 'month';

const TrendChart: React.FC = () => {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ userData: any[]; toolData: any[] }>({
    userData: [],
    toolData: [],
  });

  useEffect(() => {
    fetchData();
  }, [granularity]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, toolRes] = await Promise.all([
        getStatsTrend({ metric: 'user-register', granularity }),
        getStatsTrend({ metric: 'tool-access', granularity }),
      ]);
      setData({
        userData: userRes?.data || [],
        toolData: toolRes?.data || [],
      });
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    xField: 'date',
    children: [
      {
        data: data.userData,
        type: 'line' as const,
        yField: 'count',
        style: { stroke: '#1890ff', lineWidth: 2 },
        axis: { y: { title: '用户增长', position: 'left' as const } },
      },
      {
        data: data.toolData,
        type: 'interval' as const,
        yField: 'count',
        style: { fill: '#ffc53d', fillOpacity: 0.4 },
        axis: { y: { title: '工具使用量', position: 'right' as const } },
      },
    ],
  };

  return (
    <Card
      title="数据趋势"
      extra={
        <Radio.Group
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
          size="small"
        >
          <Radio.Button value="day">日</Radio.Button>
          <Radio.Button value="week">周</Radio.Button>
          <Radio.Button value="month">月</Radio.Button>
        </Radio.Group>
      }
      bordered={false}
    >
      <Spin spinning={loading}>
        <DualAxes {...chartConfig} height={350} />
      </Spin>
    </Card>
  );
};

export default TrendChart;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard/Overview/components/TrendChart.tsx
git commit -m "feat(admin): add TrendChart component with dual axes"
```

---

## Task 9: 前端 — 系统状态组件

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Overview/components/SystemStatus.tsx`

- [ ] **Step 1: 实现 SystemStatus 组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Overview/components/SystemStatus.tsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Statistic, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getSystemStatus } from '@/services/dashboard';

interface StatusData {
  mysql: { status: 'ok' | 'error'; latency: number };
  redis: { status: 'ok' | 'error'; latency: number };
  api: { totalRequests: number; errorRequests: number; errorRate: number; avgResponseTime: number };
  activeSessionCount: number;
}

const SystemStatus: React.FC = () => {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 60000); // 每分钟刷新
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getSystemStatus();
      if (res?.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const StatusTag: React.FC<{ status: 'ok' | 'error'; label: string; latency: number }> = ({
    status, label, latency,
  }) => (
    <Space>
      {status === 'ok' ? (
        <Tag icon={<CheckCircleOutlined />} color="success">{label}</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">{label}</Tag>
      )}
      <span style={{ fontSize: 12, color: '#999' }}>
        {latency >= 0 ? `${latency}ms` : '不可达'}
      </span>
    </Space>
  );

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="服务状态" size="small" loading={loading} bordered={false}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <StatusTag status={data?.mysql.status || 'ok'} label="MySQL" latency={data?.mysql.latency || 0} />
            <StatusTag status={data?.redis.status || 'ok'} label="Redis" latency={data?.redis.latency || 0} />
            <Statistic title="活跃会话" value={data?.activeSessionCount || 0} />
          </Space>
        </Card>
      </Col>
      <Col span={16}>
        <Card title="API 性能 (最近1小时)" size="small" loading={loading} bordered={false}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="平均响应" value={data?.api.avgResponseTime || 0} suffix="ms" />
            </Col>
            <Col span={6}>
              <Statistic
                title="错误率"
                value={data?.api.errorRate || 0}
                suffix="%"
                valueStyle={{ color: (data?.api.errorRate || 0) > 5 ? '#f5222d' : '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic title="总请求数" value={data?.api.totalRequests || 0} />
            </Col>
            <Col span={6}>
              <Statistic
                title="错误请求"
                value={data?.api.errorRequests || 0}
                valueStyle={{ color: '#f5222d' }}
              />
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default SystemStatus;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard/Overview/components/SystemStatus.tsx
git commit -m "feat(admin): add SystemStatus component"
```

---

## Task 10: 前端 — 数据概览页整合

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Overview/index.tsx`
- Create: `super-tools-admin/src/pages/Dashboard/Overview/index.less`

- [ ] **Step 1: 创建概览页主组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Overview/index.tsx
import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Space } from 'antd';
import KPICards from './components/KPICards';
import TrendChart from './components/TrendChart';
import SystemStatus from './components/SystemStatus';
import { getStatsOverview } from '@/services/dashboard';
import './index.less';

const DashboardOverview: React.FC = () => {
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOverview();
    const timer = setInterval(fetchOverview, 300000); // 5分钟轮询
    return () => clearInterval(timer);
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await getStatsOverview();
      if (res?.data) setOverviewData(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer title="数据概览" subTitle="实时业务数据监控">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <KPICards data={overviewData} loading={loading} />
        <TrendChart />
        <SystemStatus />
      </Space>
    </PageContainer>
  );
};

export default DashboardOverview;
```

- [ ] **Step 2: 创建样式文件**

```less
// super-tools-admin/src/pages/Dashboard/Overview/index.less
.dashboard-overview {
  .ant-card {
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard/Overview/
git commit -m "feat(admin): implement Dashboard Overview page"
```

---

## Task 11: 前端 — 业务分析页 用户行为组件

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Analytics/components/UserBehavior.tsx`

- [ ] **Step 1: 实现用户行为分析组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Analytics/components/UserBehavior.tsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Spin } from 'antd';
import { Area, Heatmap } from '@ant-design/charts';
import { getUserRetention, getActiveHours, getUserGrowth } from '@/services/dashboard';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const UserBehavior: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [hoursData, setHoursData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [growthRes, retentionRes, hoursRes] = await Promise.all([
        getUserGrowth({ startDate: dateRange[0], endDate: dateRange[1] }),
        getUserRetention({ startDate: dateRange[0], endDate: dateRange[1] }),
        getActiveHours({ days: 7 }),
      ]);
      setGrowthData(growthRes?.data?.data || []);
      setRetentionData(retentionRes?.data?.cohorts || []);
      setHoursData(hoursRes?.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  const DAY_NAMES = ['', '周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 转换留存数据为热力图格式
  const retentionHeatmapData = retentionData.flatMap((cohort: any) =>
    [1, 3, 7, 14, 30].map((day) => ({
      cohortDate: cohort.date,
      day: `第${day}天`,
      value: cohort.retention[`day${day}`] || 0,
    }))
  );

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="新用户增长"
            extra={
              <RangePicker
                size="small"
                value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
                onChange={(dates) => {
                  if (dates) setDateRange([dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')]);
                }}
              />
            }
            bordered={false}
          >
            <Area
              data={growthData}
              xField="date"
              yField="count"
              colorField="source"
              stack={true}
              height={280}
            />
          </Card>
        </Col>
        <Col span={14}>
          <Card title="用户留存率" bordered={false}>
            <Heatmap
              data={retentionHeatmapData}
              xField="cohortDate"
              yField="day"
              colorField="value"
              height={250}
              style={{ text: { content: (d: any) => `${d.value}%`, fontSize: 10 } }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="活跃时段分布 (近7天)" bordered={false}>
            <Heatmap
              data={hoursData.map((d: any) => ({
                ...d,
                dayName: DAY_NAMES[d.dayOfWeek] || '',
                hourLabel: `${d.hour}:00`,
              }))}
              xField="hourLabel"
              yField="dayName"
              colorField="activeUsers"
              height={250}
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default UserBehavior;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard/Analytics/components/UserBehavior.tsx
git commit -m "feat(admin): add UserBehavior analytics component"
```

---

## Task 12: 前端 — 业务分析页 工具使用组件

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Analytics/components/ToolUsage.tsx`

- [ ] **Step 1: 实现工具使用统计组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Analytics/components/ToolUsage.tsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin } from 'antd';
import { Line, Bar, Pie } from '@ant-design/charts';
import { getToolUsage, getToolCategory, getStatsTrend } from '@/services/dashboard';

const ToolUsageTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [topTools, setTopTools] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendRes, topRes, catRes] = await Promise.all([
        getStatsTrend({ metric: 'tool-access', granularity: 'day' }),
        getToolUsage({ limit: 10 }),
        getToolCategory({}),
      ]);
      setTrendData(trendRes?.data || []);
      setTopTools(topRes?.data || []);
      setCategoryData(catRes?.data?.categories || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="工具使用趋势 (近30天)" bordered={false}>
            <Line
              data={trendData}
              xField="date"
              yField="count"
              height={250}
              point={{ size: 3 }}
              style={{ stroke: '#fa8c16', lineWidth: 2 }}
            />
          </Card>
        </Col>
        <Col span={14}>
          <Card title="工具使用 TOP 10" bordered={false}>
            <Bar
              data={topTools.slice(0, 10)}
              xField="name"
              yField="count"
              height={300}
              colorField="name"
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="分类使用占比" bordered={false}>
            <Pie
              data={categoryData}
              angleField="usageCount"
              colorField="name"
              innerRadius={0.6}
              height={300}
              label={{ text: 'name', position: 'outside' }}
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default ToolUsageTab;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard/Analytics/components/ToolUsage.tsx
git commit -m "feat(admin): add ToolUsage analytics component"
```

---

## Task 13: 前端 — 业务分析页 运营效率组件

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Analytics/components/OperationEfficiency.tsx`

- [ ] **Step 1: 实现运营效率组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Analytics/components/OperationEfficiency.tsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { Column, Funnel } from '@ant-design/charts';
import { getOperationEfficiency } from '@/services/dashboard';

const OperationEfficiency: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getOperationEfficiency({});
      if (res?.data) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const funnelData = data?.memberConversion
    ? [
        { stage: '注册用户', value: data.memberConversion.registered },
        { stage: '登录用户', value: data.memberConversion.loggedIn },
        { stage: '使用工具', value: data.memberConversion.usedTool },
        { stage: '付费会员', value: data.memberConversion.paidMember },
      ]
    : [];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card bordered={false}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="反馈完成率"
                  value={data?.feedbackCompletion?.rate || 0}
                  suffix="%"
                  valueStyle={{ color: (data?.feedbackCompletion?.rate || 0) >= 80 ? '#52c41a' : '#faad14' }}
                />
              </Col>
              <Col span={8}>
                <Statistic title="总反馈数" value={data?.feedbackCompletion?.total || 0} />
              </Col>
              <Col span={8}>
                <Statistic title="已完成" value={data?.feedbackCompletion?.completed || 0} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={14}>
          <Card title="反馈响应时效 (按周)" bordered={false}>
            <Column
              data={data?.feedbackResponse || []}
              xField="week"
              yField="avgHours"
              height={280}
              label={{ text: (d: any) => `${d.avgHours}h`, position: 'inside' }}
              style={{ fill: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="会员转化漏斗" bordered={false}>
            <Funnel
              data={funnelData}
              xField="stage"
              yField="value"
              height={280}
              label={{ text: (d: any) => `${d.stage}\n${d.value}` }}
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default OperationEfficiency;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard/Analytics/components/OperationEfficiency.tsx
git commit -m "feat(admin): add OperationEfficiency analytics component"
```

---

## Task 14: 前端 — 业务分析页整合

**Files:**
- Create: `super-tools-admin/src/pages/Dashboard/Analytics/index.tsx`
- Create: `super-tools-admin/src/pages/Dashboard/Analytics/index.less`

- [ ] **Step 1: 创建分析页主组件**

```tsx
// super-tools-admin/src/pages/Dashboard/Analytics/index.tsx
import React from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Tabs } from 'antd';
import UserBehavior from './components/UserBehavior';
import ToolUsageTab from './components/ToolUsage';
import OperationEfficiency from './components/OperationEfficiency';
import './index.less';

const DashboardAnalytics: React.FC = () => {
  const items = [
    { key: 'user', label: '用户行为分析', children: <UserBehavior /> },
    { key: 'tool', label: '工具使用统计', children: <ToolUsageTab /> },
    { key: 'operation', label: '运营效率指标', children: <OperationEfficiency /> },
  ];

  return (
    <PageContainer title="业务分析" subTitle="深度数据洞察与趋势分析">
      <Tabs items={items} defaultActiveKey="user" size="large" />
    </PageContainer>
  );
};

export default DashboardAnalytics;
```

- [ ] **Step 2: 创建样式文件**

```less
// super-tools-admin/src/pages/Dashboard/Analytics/index.less
.dashboard-analytics {
  .ant-tabs-content {
    padding-top: 16px;
  }
  .ant-card {
    border-radius: 8px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard/Analytics/
git commit -m "feat(admin): implement Dashboard Analytics page with 3 tabs"
```

---

## Task 15: 删除占位页并验证

**Files:**
- Delete/Modify: `super-tools-admin/src/pages/Dashboard/Placeholder.tsx` (如存在)
- Modify: 旧的路由引用清理

- [ ] **Step 1: 清理旧的占位页引用**

检查 `config/routes/index.ts` 中是否有指向 `./Dashboard/Placeholder` 的旧路由，移除之。检查是否有 `/stats/overview` 和 `/dashboard` 的旧路由指向 Placeholder，替换为新的 dashboard 路由模块。

- [ ] **Step 2: 验证前端编译通过**

```bash
cd super-tools-admin
npm run build
```

Expected: 编译成功，无错误

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(admin): remove dashboard placeholder, wire up real pages"
```

---

## Task 16: 集成测试验证

- [ ] **Step 1: 启动后端验证新接口**

```bash
cd super-tool-node
npm run dev
```

然后用 curl 测试：

```bash
curl -H "Authorization: Bearer <token>" http://localhost:7001/api/admin/stats/user-retention?startDate=2026-04-01&endDate=2026-05-14
curl -H "Authorization: Bearer <token>" http://localhost:7001/api/admin/stats/active-hours?days=7
curl -H "Authorization: Bearer <token>" http://localhost:7001/api/admin/stats/tool-category
curl -H "Authorization: Bearer <token>" http://localhost:7001/api/admin/stats/operation-efficiency
curl -H "Authorization: Bearer <token>" http://localhost:7001/api/admin/stats/user-growth?granularity=day
curl -H "Authorization: Bearer <token>" http://localhost:7001/api/admin/dashboard/system-status
```

Expected: 所有接口返回 `{ code: 0, data: {...} }`

- [ ] **Step 2: 启动前端验证页面渲染**

```bash
cd super-tools-admin
npm run start
```

访问：
- `http://localhost:8000/dashboard/overview` — 应看到 KPI 卡片 + 趋势图 + 系统状态
- `http://localhost:8000/dashboard/analytics` — 应看到 3 个 Tab 页

- [ ] **Step 3: 最终 commit**

```bash
git add -A
git commit -m "feat: complete Dashboard Phase 1 - Overview and Analytics"
```

---

## Summary

| Task | 内容 | 预计时间 |
|------|------|---------|
| 1 | 安装图表依赖 | 2min |
| 2 | DashboardService (systemStatus) | 5min |
| 3 | StatsService 扩展 (5方法) | 15min |
| 4 | Controller + 路由注册 | 10min |
| 5 | 前端 API Service | 5min |
| 6 | 路由配置 | 5min |
| 7 | KPICards 组件 | 10min |
| 8 | TrendChart 组件 | 10min |
| 9 | SystemStatus 组件 | 10min |
| 10 | 概览页整合 | 5min |
| 11 | UserBehavior 组件 | 15min |
| 12 | ToolUsage 组件 | 10min |
| 13 | OperationEfficiency 组件 | 10min |
| 14 | 分析页整合 | 5min |
| 15 | 清理占位页 | 5min |
| 16 | 集成测试 | 10min |
| **Total** | | **~2h** |
