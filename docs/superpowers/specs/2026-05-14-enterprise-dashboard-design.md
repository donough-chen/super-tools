# 企业数据统计 Dashboard 设计方案

> **状态：** 已批准  
> **日期：** 2026-05-14  
> **技术栈：** Egg.js 3 + Sequelize 6 + MySQL + Redis + UmiJS 3 + Ant Design 5 + DVA  

---

## 目录

1. [设计约束与决策](#1-设计约束与决策)
2. [整体架构](#2-整体架构)
3. [模块一：整体数据概览](#3-模块一整体数据概览)
4. [模块二：业务数据分析](#4-模块二业务数据分析)
5. [模块三：部门级数据视图](#5-模块三部门级数据视图)
6. [模块四：智能化预警和提醒](#6-模块四智能化预警和提醒)
7. [模块五：数据可视化配置](#7-模块五数据可视化配置)
8. [模块六：移动端适配](#8-模块六移动端适配)
9. [数据库变更汇总](#9-数据库变更汇总)
10. [接口汇总](#10-接口汇总)
11. [权限设计](#11-权限设计)
12. [依赖与技术选型](#12-依赖与技术选型)
13. [前端路由规划](#13-前端路由规划)
14. [实施路线图](#14-实施路线图)

---

## 1. 设计约束与决策

| 维度 | 决策 | 原因 |
|------|------|------|
| 组织架构 | 用现有 `roles` 表模拟部门划分 | 避免引入复杂组织架构模块 |
| 数据来源 | 基于现有数据（用户/工具/会员/反馈），订单/销售额扩展预留 | 先做已有数据深度挖掘 |
| 实时性 | 混合模式：核心指标 WebSocket 推送 + 其他按需刷新 | 平衡体验与性能 |
| 技术方案 | 增量式模块化 Dashboard（方案 A） | 与现有单体架构一致 |
| 图表库 | @ant-design/charts | 与 AntD 5 生态统一 |
| 拖拽布局 | react-grid-layout | 专为 Dashboard 网格设计 |
| 实时通信 | egg-socket.io | Egg.js 官方插件 |

---

## 2. 整体架构

```
┌───────────────────── 前端层 (super-tools-admin) ─────────────────────┐
│  概览页 | 分析页 | 部门页 | 预警页 | 配置页 | 移动视图              │
│                    Dashboard Service Layer (DVA)                      │
│           WebSocket Client | REST Client | Layout Engine             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP + WebSocket
┌──────────────────────────────┼───────────────────────────────────────┐
│                      后端层 (super-tool-node)                         │
│  Router + Middleware (auth + checkPermission + rateLimit)             │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │Dashboard │  Stats   │  Alert   │  Layout  │Socket.IO │           │
│  │Controller│Controller│Controller│Controller│Namespace │           │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┤           │
│  │Dashboard │  Stats   │  Alert   │  Layout  │ Realtime │           │
│  │ Service  │ Service  │ Service  │ Service  │ Service  │           │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘           │
│              Sequelize Models + Redis Cache Layer                     │
└──────────────────────────────┬───────────────────────────────────────┘
              ┌────────────────┼────────────────┐
         MySQL (数据源)   Redis (缓存)    定时任务(告警检测)
```

---

## 3. 模块一：整体数据概览

**页面路径：** `/dashboard/overview`

### 3.1 KPI 指标卡片（6个）

| 指标 | 数据来源 | 实时性 | 对比 |
|------|---------|--------|------|
| 用户总数 | `users` COUNT | WebSocket(30s) | 较昨日增长率 |
| 今日活跃用户 | `login_logs` 今日去重 | WebSocket(30s) | 较昨日同期 |
| 今日新增用户 | `users` 今日 created_at | WebSocket(30s) | 较昨日同期 |
| 工具使用次数 | `api_logs` 工具路径聚合 | 轮询(5min) | 较昨日同期 |
| 付费会员数 | `user_members` is_paid=1 | 轮询(5min) | 较上周 |
| 待处理反馈 | `feedbacks` status=0 | WebSocket(30s) | 无 |

每卡片含：主指标值、环比变化(↑↓+%)、7天 Sparkline。

### 3.2 数据趋势图表

- 图表：`@ant-design/charts` DualAxes 双轴折线图
- 默认：左轴=用户增长，右轴=工具使用量
- 维度切换：日(近30天)/周(近12周)/月(近12月)
- 交互：Tooltip、图例切换、区域缩放

### 3.3 系统状态监控

| 监控项 | 数据源 | 刷新 |
|--------|--------|------|
| API 平均响应时间 | `api_logs` AVG(response_time) | 1min |
| API 错误率 | `api_logs` status>=400 占比 | 1min |
| 活跃会话数 | `user_sessions` is_active=1 | 30s(WS) |
| MySQL 状态 | sequelize.authenticate() | 30s |
| Redis 状态 | redis.ping() | 30s |
| API p50/p95/p99 | 百分位计算 | 5min |

### 3.4 接口设计

```
复用: GET /api/admin/stats/overview
复用: GET /api/admin/stats/trend
新增: GET /api/admin/dashboard/realtime       → WebSocket初始快照
新增: GET /api/admin/dashboard/system-status  → 系统运维状态
```

### 3.5 WebSocket 设计

```
Plugin: egg-socket.io | Namespace: /dashboard
认证: socket.handshake.query.token (JWT)

事件:
  'stats:update'   → 每30s推送核心指标
  'alert:new'      → 告警触发即时推送
  'system:status'  → 每60s推送系统状态
```

### 3.6 缓存策略

```
'dashboard:overview'                              TTL: 30s
'dashboard:system-status'                         TTL: 60s
'dashboard:trend:{metric}:{granularity}:{date}'   TTL: 5min
'dashboard:sparkline:{metric}'                    TTL: 5min
```

---

## 4. 模块二：业务数据分析

**页面路径：** `/dashboard/analytics`

### 4.1 Tab 结构

- Tab1: 用户行为分析
- Tab2: 工具使用统计
- Tab3: 运营效率指标

### 4.2 用户行为分析

**新用户增长：**
- SQL: `users` 按日聚合 + `register_source` 分组
- 图表: 堆叠面积图 (web/h5/miniprogram/ios/android)

**用户留存率：**
- 计算: 注册第N天在 `login_logs` 有记录的用户比例
- 图表: 热力图矩阵 (横轴=注册日期，纵轴=第1/3/7/14/30天，颜色=留存率)

**活跃时段分布：**
- SQL: `login_logs.created_at` 按 HOUR + DAYOFWEEK 聚合
- 图表: 24h×7d 热力图

### 4.3 工具使用统计

| 指标 | 图表 | 数据源 |
|------|------|--------|
| 使用趋势 | 双线折线图(总量+独立用户) | `api_logs` |
| TOP 10 排行 | 横向柱状图 | 复用 `stats/tool-usage` |
| 分类占比 | 环形图 | `tools` JOIN `tool_categories` |
| 会员工具使用率 | 对比柱状图 | `tools.require_paid` |

### 4.4 运营效率指标

| 指标 | 计算 | 图表 |
|------|------|------|
| 反馈平均响应时间 | (首次reply - created_at) 均值 | 柱状图(按周) |
| 反馈完成率 | status=3 / 总量 × 100% | 折线+目标线 |
| 会员转化漏斗 | 注册→登录→工具使用→付费 | 漏斗图 |
| 每日签到率 | daily_sign / 活跃用户 | 折线图 |

### 4.5 新增接口

```
GET /api/admin/stats/user-retention      用户留存率
GET /api/admin/stats/active-hours        活跃时段分布
GET /api/admin/stats/tool-category       工具分类统计
GET /api/admin/stats/operation-efficiency 运营效率
GET /api/admin/stats/user-growth         用户增长(按渠道)
```

---

## 5. 模块三：部门级数据视图

**页面路径：** `/dashboard/department`

### 5.1 设计思路

用 `roles` 模拟部门。新增 `role_category` 字段区分：
- `system`：系统角色 (super_admin/admin/operator/user/guest)
- `department`：部门角色 (用于Dashboard)
- `custom`：自定义角色

### 5.2 权限控制

```typescript
'dashboard:department:all'  → 可查看所有部门 (admin+)
'dashboard:department:own'  → 仅查看自己所属部门

// Service层: 无all权限时自动过滤为用户所属department角色
```

### 5.3 部门 KPI 对比

| 维度 | 计算 |
|------|------|
| 活跃率 | 日均活跃/部门总人数 (`login_logs` JOIN `user_roles`) |
| 工具使用 | 人均使用次数 (`api_logs` JOIN `user_roles`) |
| 反馈贡献 | 有效反馈占比 (`feedbacks` JOIN `user_roles`) |
| 会员渗透 | 付费会员率 (`user_members` JOIN `user_roles`) |

### 5.4 跨部门协作

通过工具使用重合度衡量，图表：和弦图/桑基图

### 5.5 新增接口

```
GET /api/admin/stats/department/overview      各部门概览
GET /api/admin/stats/department/compare       部门对比趋势
GET /api/admin/stats/department/collaboration 跨部门协作
```

---

## 6. 模块四：智能化预警和提醒

### 6.1 架构

```
数据采集(定时任务每分钟) → 规则引擎(阈值/环比检测) → 通知分发(WS/站内信/邮件)
```

### 6.2 数据库设计

**alert_rules 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 自增 |
| name | VARCHAR(100) | 规则名称 |
| metric_type | ENUM | user_count/active_user/new_user/tool_usage/error_rate/response_time/feedback_pending/member_expire/session_count |
| condition_type | ENUM | gt/lt/gte/lte/change_rate_up/change_rate_down |
| threshold | DECIMAL(10,2) | 阈值 |
| time_window | INT | 检测时间窗口(分钟) |
| compare_window | INT | 环比对比窗口(分钟) |
| severity | ENUM | info/warning/critical |
| notify_channels | JSON | 通知渠道 |
| notify_role_ids | JSON | 通知角色 |
| is_enabled | TINYINT | 启用状态 |
| cooldown_minutes | INT | 冷却时间 |
| last_triggered_at | DATETIME | 上次触发时间 |

**alert_logs 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 自增 |
| rule_id | INT FK | 规则ID |
| metric_value | DECIMAL | 触发时指标值 |
| threshold_value | DECIMAL | 阈值 |
| condition_desc | VARCHAR | 条件描述 |
| severity | ENUM | 严重级别 |
| status | ENUM | firing/acknowledged/resolved |
| acknowledged_by | INT | 确认人 |
| resolved_at | DATETIME | 解决时间 |
| resolve_note | VARCHAR | 解决备注 |
| details | JSON | 详细上下文 |

### 6.3 预置告警规则

| 规则 | 指标 | 条件 | 阈值 | 严重度 |
|------|------|------|------|--------|
| API错误率飙升 | error_rate | >5% | 5min窗口 | critical |
| 新用户骤降 | new_user | 环比↓50% | 24h对比 | warning |
| 反馈积压 | feedback_pending | >50条 | - | warning |
| 活跃用户下降 | active_user | 环比↓30% | 24h对比 | critical |
| 会员批量到期 | member_expire | >100人 | 7天窗口 | info |
| API响应变慢 | response_time | >3000ms | 5min窗口 | warning |
| 在线会话异常 | session_count | >10000 | 5min窗口 | warning |

### 6.4 检测逻辑

```typescript
// app/schedule/alert_check.ts - 每60s执行
async checkAllRules() {
  const rules = await AlertRule.findAll({ where: { is_enabled: 1 } });
  for (const rule of rules) {
    if (isInCooldown(rule)) continue;
    const value = await collectMetric(rule.metric_type, rule.time_window);
    if (evaluateCondition(rule, value)) {
      await fireAlert(rule, value); // 写日志+推送
    }
  }
}
```

### 6.5 新增接口

```
GET    /api/admin/alerts/rules              规则列表
POST   /api/admin/alerts/rules              创建规则
PUT    /api/admin/alerts/rules/:id          更新规则
DELETE /api/admin/alerts/rules/:id          删除规则
PUT    /api/admin/alerts/rules/:id/toggle   启用/禁用
GET    /api/admin/alerts/logs               告警记录
PUT    /api/admin/alerts/logs/:id/acknowledge  确认告警
PUT    /api/admin/alerts/logs/:id/resolve      解决告警
GET    /api/admin/alerts/summary            告警统计
```

---

## 7. 模块五：数据可视化配置

### 7.1 数据库设计

**dashboard_layouts 表：** user_id, name, is_default, is_shared, share_token, layout_config(JSON)

**dashboard_widgets 表：** layout_id, widget_type(12种), title, data_config(JSON), style_config(JSON), position(JSON{x,y,w,h}), refresh_interval

### 7.2 组件注册表（12种组件）

| 类型 | 名称 | 默认尺寸 |
|------|------|---------|
| kpi_card | KPI指标卡片 | 3×2 |
| line_chart | 折线图 | 6×4 |
| area_chart | 面积图 | 6×4 |
| bar_chart | 柱状图 | 6×4 |
| pie_chart | 饼图/环形图 | 4×4 |
| heatmap | 热力图 | 6×4 |
| table | 数据表格 | 6×4 |
| funnel | 漏斗图 | 4×4 |
| gauge | 仪表盘 | 3×3 |
| alert_list | 告警列表 | 4×4 |
| ranking | 排行榜 | 4×4 |
| text | 文本说明 | 3×2 |

### 7.3 前端方案

- 布局引擎: `react-grid-layout` (响应式12列网格)
- 编辑模式: 拖拽手柄 + 缩放控件 + 删除/配置按钮
- 组件面板: 侧边 Drawer 展示可用组件，拖入画布
- 配置面板: 右侧 Drawer 配置数据源/时间范围/样式

### 7.4 报表导出

| 格式 | 方案 | 位置 |
|------|------|------|
| PNG | html2canvas | 前端 |
| PDF | html2canvas + jsPDF | 前端 |
| CSV | 流式返回 | 后端(复用已有) |
| Excel | exceljs | 后端 |

### 7.5 新增接口

```
GET    /api/admin/dashboard/layouts           布局列表
GET    /api/admin/dashboard/layouts/:id       布局详情
POST   /api/admin/dashboard/layouts           创建布局
PUT    /api/admin/dashboard/layouts/:id       更新布局
DELETE /api/admin/dashboard/layouts/:id       删除布局
PUT    /api/admin/dashboard/layouts/:id/default  设为默认
POST   /api/admin/dashboard/layouts/:id/share    分享布局
GET    /api/admin/dashboard/shared/:token        获取分享(免登录)
POST   /api/admin/dashboard/widget-data          统一组件数据接口
GET    /api/admin/dashboard/export               导出报表
```

---

## 8. 模块六：移动端适配

### 8.1 策略

响应式设计 + 移动端专属快捷视图，非独立App。

### 8.2 断点设计

```
xs: 480px (手机竖) → 单列堆叠
sm: 576px (手机横)
md: 768px (平板)   → 6列网格
lg: 992px (桌面)
xl: 1200px (大屏)  → 12列网格
```

### 8.3 移动端快捷视图

**路径：** `/dashboard/mobile`

内容：
- 2×3 紧凑 KPI 卡片（隐藏 Sparkline）
- 简化趋势图（今日vs昨日单线）
- 最新3条告警
- 快捷操作入口（用户/工具/反馈/报表/设置）

### 8.4 消息推送

- 推送来源：告警引擎(critical即时) + 每日摘要(09:00) + 手动推送
- 渠道：WebSocket → 站内信(notifications表) → 邮件(扩展预留)
- 偏好设置：总开关、渠道选择、严重度过滤、免打扰时段

### 8.5 新增接口

```
GET  /api/admin/dashboard/mobile-summary     移动端精简数据
GET  /api/admin/dashboard/push-settings      推送偏好(读)
POST /api/admin/dashboard/push-settings      推送偏好(写)
GET  /api/admin/dashboard/notifications      通知列表
PUT  /api/admin/dashboard/notifications/:id/read    标记已读
PUT  /api/admin/dashboard/notifications/read-all    全部已读
```

---

## 9. 数据库变更汇总

### 9.1 新增表

| 表名 | 模块 | 说明 |
|------|------|------|
| alert_rules | 预警 | 告警规则配置 |
| alert_logs | 预警 | 告警触发记录 |
| dashboard_layouts | 配置 | 仪表板布局 |
| dashboard_widgets | 配置 | 仪表板组件 |

### 9.2 表变更

| 表 | 变更 |
|------|------|
| roles | 新增 `role_category ENUM('system','department','custom') DEFAULT 'system'` |

### 9.3 迁移文件

`database/014_add_dashboard_system.sql` — 包含上述所有DDL + 预置告警规则 + 系统默认布局。

---

## 10. 接口汇总

### 复用已有 (5个)

| 接口 | 用途 |
|------|------|
| GET /api/admin/stats/overview | 8指标大盘 |
| GET /api/admin/stats/tool-usage | 工具TOP N |
| GET /api/admin/stats/user-active | DAU/WAU/MAU |
| GET /api/admin/stats/trend | 通用趋势 |
| GET /api/admin/stats/export | CSV导出 |

### 新增 (33个)

| 模块 | 数量 | 接口概述 |
|------|------|---------|
| 概览 | 2 | realtime, system-status |
| 分析 | 5 | user-retention, active-hours, tool-category, operation-efficiency, user-growth |
| 部门 | 3 | department/overview, compare, collaboration |
| 预警 | 9 | rules CRUD+toggle, logs+acknowledge+resolve, summary |
| 配置 | 10 | layouts CRUD+default+share, shared/:token, widget-data, export |
| 移动 | 6 | mobile-summary, push-settings(R/W), notifications+read+read-all |

---

## 11. 权限设计

### 新增权限码

| 码 | 类型 | 名称 |
|------|------|------|
| dashboard | 目录 | 数据看板 |
| dashboard:overview | 菜单 | 数据概览 |
| dashboard:analytics | 菜单 | 业务分析 |
| dashboard:department | 菜单 | 部门视图 |
| dashboard:alerts | 菜单 | 智能预警 |
| dashboard:config | 菜单 | 可视化配置 |
| dashboard:department:all | 按钮 | 查看全部部门 |
| dashboard:department:own | 按钮 | 查看本部门 |
| dashboard:alerts:manage | 按钮 | 管理告警规则 |
| dashboard:config:edit | 按钮 | 编辑布局 |
| dashboard:export | 按钮 | 导出报表 |

### 角色默认分配

| 权限 | super_admin | admin | operator | user |
|------|:-:|:-:|:-:|:-:|
| overview | ✅ | ✅ | ✅ | ✅ |
| analytics | ✅ | ✅ | ✅ | ❌ |
| department | ✅ | ✅ | ❌ | ❌ |
| department:all | ✅ | ✅ | ❌ | ❌ |
| alerts | ✅ | ✅ | ✅ | ❌ |
| alerts:manage | ✅ | ✅ | ❌ | ❌ |
| config | ✅ | ✅ | ✅ | ✅ |
| config:edit | ✅ | ✅ | ✅ | ❌ |
| export | ✅ | ✅ | ✅ | ❌ |

---

## 12. 依赖与技术选型

### 后端新增

```json
{ "egg-socket.io": "^4.2.0" }
```

### 前端新增

```json
{
  "react-grid-layout": "^1.4.0",
  "@ant-design/charts": "^2.0.0",
  "socket.io-client": "^4.7.0",
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.1"
}
```

---

## 13. 前端路由规划

```typescript
// config/routes/modules/dashboard.ts
export default [
  {
    path: '/dashboard',
    name: '数据看板',
    icon: 'DashboardOutlined',
    routes: [
      { path: '/dashboard/overview', name: '数据概览', component: './Dashboard/Overview' },
      { path: '/dashboard/analytics', name: '业务分析', component: './Dashboard/Analytics' },
      { path: '/dashboard/department', name: '部门视图', component: './Dashboard/Department' },
      { path: '/dashboard/alerts', name: '智能预警', component: './Dashboard/Alerts' },
      { path: '/dashboard/alerts/rules', name: '告警规则', component: './Dashboard/Alerts/Rules', hideInMenu: true },
      { path: '/dashboard/config', name: '可视化配置', component: './Dashboard/Config' },
      { path: '/dashboard/mobile', name: '移动视图', component: './Dashboard/Mobile', hideInMenu: true },
    ],
  },
];
```

### 前端目录结构

```
src/pages/Dashboard/
├── Overview/           数据概览
│   ├── index.tsx
│   ├── components/
│   │   ├── KPICards.tsx
│   │   ├── TrendChart.tsx
│   │   └── SystemStatus.tsx
│   └── index.less
├── Analytics/          业务分析
│   ├── index.tsx
│   ├── components/
│   │   ├── UserBehavior.tsx
│   │   ├── ToolUsage.tsx
│   │   └── OperationEfficiency.tsx
│   └── index.less
├── Department/         部门视图
├── Alerts/             智能预警
│   ├── index.tsx       告警列表
│   └── Rules/          规则管理
├── Config/             可视化配置
│   ├── index.tsx       布局编辑器
│   ├── components/
│   │   ├── WidgetPanel.tsx
│   │   ├── ConfigDrawer.tsx
│   │   └── GridLayout.tsx
│   └── widgets/        组件注册表
│       ├── registry.ts
│       └── components/ (12个组件)
└── Mobile/             移动端视图
```

---

## 14. 实施路线图

| Phase | 模块 | 工作量估计 | 依赖 |
|-------|------|-----------|------|
| Phase 1 | 数据概览 + 业务分析 | 2-3周 | 复用已有Stats API |
| Phase 2 | 部门视图 | 1-2周 | roles表扩展 |
| Phase 3 | 智能预警 | 2-3周 | alert表+定时任务+WebSocket |
| Phase 4 | 可视化配置 | 3-4周 | react-grid-layout集成 |
| Phase 5 | 移动端适配 | 1-2周 | 响应式CSS+推送 |

**建议优先级：** Phase 1 > Phase 3 > Phase 2 > Phase 4 > Phase 5

**理由：** Phase 1 可立即对接已有API填充占位页，价值最高；Phase 3 的告警系统对运维至关重要；Phase 4 开发量最大但非必需。

---

## 附录：UX 优化建议

1. **首屏加载优化**：KPI卡片使用骨架屏(Skeleton)，图表懒加载
2. **数据刷新指示**：卡片右上角显示"最后更新时间"，刷新时微弱闪烁动画
3. **暗色主题**：Dashboard 支持暗色模式切换（大屏投放场景）
4. **键盘快捷键**：`R`刷新、`E`进入编辑模式、`Esc`退出编辑
5. **引导教程**：首次访问展示功能引导(Tour组件)
6. **空状态设计**：无数据时展示友好的空状态插图和建议操作
