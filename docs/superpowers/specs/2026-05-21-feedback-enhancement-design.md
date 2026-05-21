# 反馈模块全面优化设计规范

## 文档信息
- **版本**: 1.0.0
- **创建时间**: 2026-05-21
- **状态**: 已确认

---

## 一、项目背景

### 1.1 现状

当前反馈模块已有基础实现：

| 层面 | 已有 | 缺失 |
|------|------|------|
| 后端 | CRUD + 回复 + 状态机 + 回复通知 | 状态变更通知未接入、统计API、用户端查询API |
| 管理端 | 列表 + 筛选 + 详情抽屉 + 回复 | 统计页面、批量操作 |
| H5端 | 无 | 提交页、历史列表页、详情页 |
| 通知集成 | BUSINESS_FEEDBACK_REPLY 已接入 | BUSINESS_FEEDBACK_STATUS/NEW 未接入 |

### 1.2 目标

构建从用户反馈提交到问题解决的完整闭环系统：
1. H5端用户反馈入口（提交、查看历史、跟踪进度）
2. 管理端统计分析页面
3. 通知模块完整集成（新反馈通知管理员 + 状态变更通知用户）
4. RBAC 权限配置完善
5. Badge 角标实时提醒

---

## 二、架构设计

```
用户端(H5)                    后端(Node/Egg)                管理端(Admin)
┌─────────────┐              ┌──────────────────┐          ┌─────────────────┐
│ 提交反馈页   │──POST──────→│ feedback.create   │──notify─→│ Badge角标刷新    │
│ 反馈历史页   │──GET───────→│ feedback.myList   │          │                 │
│ 反馈详情页   │──GET───────→│ feedback.myDetail │          │ 反馈列表页(已有) │
│ (接收通知)   │←──notify────│ notification.send │←─reply──│ 详情+回复(已有)  │
└─────────────┘              │ feedback.stats    │──GET───→│ 统计分析页(新增) │
                             └──────────────────┘          └─────────────────┘
```

---

## 三、后端 API 设计

### 3.1 新增用户端接口

| 方法 | 路由 | 描述 | 认证 | 限流 |
|------|------|------|------|------|
| POST | `/api/feedback` | 提交反馈（已有） | 可选 | 10 req/h/IP |
| GET | `/api/feedback/mine` | 我的反馈列表 | 需登录 | — |
| GET | `/api/feedback/mine/:id` | 我的反馈详情 | 需登录 | — |

#### GET /api/feedback/mine

**请求参数（Query）**:
```ts
{
  page?: number;      // 默认 1
  pageSize?: number;  // 默认 20, max 50
  status?: 0 | 1 | 2 | 3;  // 可选筛选
}
```

**响应**:
```ts
{
  code: 200,
  data: {
    total: number;
    page: number;
    pageSize: number;
    rows: Array<{
      id: number;
      type: string;
      content: string;       // 截断前100字
      status: 0 | 1 | 2 | 3;
      createdAt: string;
      repliedAt: string | null;
    }>;
  }
}
```

#### GET /api/feedback/mine/:id

**响应**:
```ts
{
  code: 200,
  data: {
    id: number;
    type: string;
    content: string;         // 完整内容
    contact: string | null;
    platform: string | null;
    status: 0 | 1 | 2 | 3;
    replyContent: string | null;
    repliedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }
}
```

**安全**: 校验 `userId === ctx.state.user.id`，防止越权访问他人反馈。

### 3.2 新增管理端统计接口

| 方法 | 路由 | 描述 | 权限码 |
|------|------|------|--------|
| GET | `/api/admin/feedbacks/stats/overview` | 统计概览 | `feedback:stats:overview` |
| GET | `/api/admin/feedbacks/stats/trend` | 趋势数据 | `feedback:stats:trend` |
| GET | `/api/admin/feedbacks/pending-count` | 待处理计数 | `feedback:pending-count` |

#### GET /api/admin/feedbacks/stats/overview

**响应**:
```ts
{
  code: 200,
  data: {
    total: number;           // 总反馈数
    pending: number;         // 待处理 (status=0)
    processing: number;      // 处理中 (status=1)
    replied: number;         // 已回复 (status=2)
    closed: number;          // 已关闭 (status=3)
    todayNew: number;        // 今日新增
    avgReplyHours: number;   // 平均回复时长（小时）
    byType: {                // 按类型分布
      bug: number;
      suggestion: number;
      praise: number;
      other: number;
    };
  }
}
```

#### GET /api/admin/feedbacks/stats/trend

**请求参数（Query）**:
```ts
{
  days?: number;    // 默认 30，最大 90
  granularity?: 'day' | 'week';  // 默认 day
}
```

**响应**:
```ts
{
  code: 200,
  data: {
    items: Array<{
      date: string;         // YYYY-MM-DD
      submitted: number;    // 提交数
      replied: number;      // 回复数
      closed: number;       // 关闭数
    }>;
  }
}
```

#### GET /api/admin/feedbacks/pending-count

**响应**:
```ts
{
  code: 200,
  data: { count: number }
}
```

---

## 四、通知集成设计

### 4.1 通知类型

| typeCode | 名称 | 触发时机 | 接收方 | 渠道 | 优先级 | 可退订 |
|----------|------|---------|--------|------|--------|--------|
| `BUSINESS_FEEDBACK_NEW` | 新反馈提交 | 用户提交反馈 | 管理员角色用户 | in_app | P2 | 是 |
| `BUSINESS_FEEDBACK_STATUS` | 反馈状态变更 | 状态转为处理中/已关闭 | 提交用户 | in_app | P2 | 是 |
| `BUSINESS_FEEDBACK_REPLY` | 反馈回复 | 管理员回复 | 提交用户 | in_app + email | P1 | 是 |

### 4.2 通知流程

```
1. 用户提交反馈
   → service.notification.core.sendByAudience({
       typeCode: 'BUSINESS_FEEDBACK_NEW',
       audienceCode: 'admin_role',   // 发给所有admin/operator
       variables: { feedbackType, contentPreview },
       extra: { feedbackId }
     })

2. 管理员标记"处理中" (0→1)
   → service.notification.core.send({
       typeCode: 'BUSINESS_FEEDBACK_STATUS',
       userId: feedback.userId,
       variables: { feedbackTitle, newStatus: '处理中' },
       extra: { feedbackId }
     })

3. 管理员回复 (0/1→2)  [已实现]
   → BUSINESS_FEEDBACK_REPLY

4. 管理员关闭 (→3)
   → service.notification.core.send({
       typeCode: 'BUSINESS_FEEDBACK_STATUS',
       userId: feedback.userId,
       variables: { feedbackTitle, newStatus: '已关闭' },
       extra: { feedbackId }
     })
```

### 4.3 通知触发条件

- `BUSINESS_FEEDBACK_NEW`: 仅当 `userId` 不为 null（匿名反馈不通知，无目标用户语境）
- `BUSINESS_FEEDBACK_STATUS`: 仅当 `feedback.userId` 不为 null
- 状态幂等（from === to）不触发通知

---

## 五、RBAC 权限设计

### 5.1 权限层次结构

```
feedback (目录, type=1, path=/feedback)          ← 升级自 type=2
├── feedback:list-page (菜单, type=2, path=/feedback/list)
│   ├── feedback:list (API, type=4)             ← 已有
│   ├── feedback:detail (API, type=4)           ← 已有
│   ├── feedback:reply (API, type=4)            ← 已有
│   ├── feedback:update (API, type=4)           ← 已有
│   ├── feedback:delete (API, type=4)           ← 已有
│   ├── feedback:pending-count (API, type=4)    ← 新增
│   └── feedback:batch-close (按钮, type=3)     ← 新增
└── feedback:stats-page (菜单, type=2, path=/feedback/stats)
    ├── feedback:stats:overview (API, type=4)   ← 新增
    └── feedback:stats:trend (API, type=4)      ← 新增
```

### 5.2 新增权限码

| code | name | type | module | path | method | parent_code | sort |
|------|------|------|--------|------|--------|-------------|------|
| `feedback:list-page` | 反馈列表 | 2 | feedback | /feedback/list | — | feedback | 10 |
| `feedback:stats-page` | 反馈统计 | 2 | feedback | /feedback/stats | — | feedback | 20 |
| `feedback:batch-close` | 批量关闭 | 3 | feedback | — | — | feedback:list-page | 10 |
| `feedback:stats:overview` | 反馈统计概览 | 4 | feedback | /api/admin/feedbacks/stats/overview | GET | feedback:stats-page | 10 |
| `feedback:stats:trend` | 反馈统计趋势 | 4 | feedback | /api/admin/feedbacks/stats/trend | GET | feedback:stats-page | 20 |
| `feedback:pending-count` | 待处理计数 | 4 | feedback | /api/admin/feedbacks/pending-count | GET | feedback:list-page | 50 |

### 5.3 角色 × 权限映射

| 权限码 | admin | operator | auditor |
|--------|:-----:|:--------:|:-------:|
| `feedback` (目录) | ✅ | ✅ | ✅ |
| `feedback:list-page` | ✅ | ✅ | ✅ |
| `feedback:stats-page` | ✅ | ✅ | ✅ |
| `feedback:batch-close` | ✅ | ✅ | ❌ |
| `feedback:list` | ✅ | ✅ | ✅ |
| `feedback:detail` | ✅ | ✅ | ✅ |
| `feedback:reply` | ✅ | ✅ | ❌ |
| `feedback:update` | ✅ | ✅ | ❌ |
| `feedback:delete` | ✅ | ✅ | ❌ |
| `feedback:pending-count` | ✅ | ✅ | ✅ |
| `feedback:stats:overview` | ✅ | ✅ | ✅ |
| `feedback:stats:trend` | ✅ | ✅ | ✅ |

### 5.4 前端权限控制

**路由级**:
- `/feedback/list` → wrappers: AuthWrapper
- `/feedback/stats` → wrappers: AuthWrapper

**按钮级**:
- 回复按钮: `permCode="feedback:reply"`
- 删除按钮: `permCode="feedback:delete"`
- 状态变更: `permCode="feedback:update"`
- 批量关闭: `permCode="feedback:batch-close"`

---

## 六、H5 端页面设计

### 6.1 反馈提交页 `/pages/feedback/index.tsx`

**功能**:
- 反馈分类选择（bug/建议/表扬/其他）— Radio 按钮组
- 文字内容输入（5-2000字）— TextArea
- 联系方式输入（未登录必填）— Input
- 提交按钮 + loading 状态
- 提交成功 → Toast 提示 + 跳转历史页

**交互细节**:
- 登录用户自动隐藏联系方式字段
- 内容字数实时计数
- 提交前表单校验

### 6.2 反馈历史页 `/pages/feedback/history/index.tsx`

**功能**:
- 需要登录才能访问（未登录引导登录）
- 反馈列表（卡片形式）
- 每条显示：类型标签 + 内容摘要(50字) + 状态标签 + 时间
- 下拉刷新 + 触底加载更多
- 点击跳转详情页
- 空状态引导提交

**状态标签样式**:
- 待处理 (0): 灰色
- 处理中 (1): 蓝色
- 已回复 (2): 绿色
- 已关闭 (3): 默认色

### 6.3 反馈详情页 `/pages/feedback/detail/[id].tsx`

**功能**:
- 显示完整反馈内容
- 状态进度条/时间线
- 管理员回复内容（如有）
- 回复时间

**进度时间线**:
```
● 提交反馈  2026-05-21 10:00
● 已受理    2026-05-21 14:30  (status >= 1)
● 已回复    2026-05-21 16:00  (status >= 2)
○ 已关闭                       (status = 3)
```

---

## 七、管理端统计页设计

### 7.1 页面结构 `/pages/Feedback/Stats/index.tsx`

**布局**:
```
┌─────────────────────────────────────────────────────┐
│  概览卡片 (4个)                                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│  │总数 │ │待处理│ │今日新│ │平均时│                       │
│  │    │ │    │ │增  │ │长  │                       │
│  └────┘ └────┘ └────┘ └────┘                       │
├─────────────────────────────────────────────────────┤
│  趋势折线图 (近30天)                                   │
│  ┌─────────────────────────────────────────────┐    │
│  │  提交数 / 回复数 / 关闭数 三条线               │    │
│  └─────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│  分类饼图              │  状态分布饼图                  │
│  ┌──────────┐         │  ┌──────────┐               │
│  │ bug/建议  │         │  │ 各状态占比│               │
│  │ 表扬/其他 │         │  │          │               │
│  └──────────┘         │  └──────────┘               │
└─────────────────────────────────────────────────────┘
```

**交互**:
- 时间范围选择器（7天/30天/90天）
- 自动刷新（每5分钟）

### 7.2 Badge 角标

管理端侧边栏「反馈管理」菜单项旁显示待处理数量 badge：
- 页面加载时调用 `/api/admin/feedbacks/pending-count`
- 每 60 秒轮询一次
- 数量 > 99 显示 "99+"
- 数量为 0 时隐藏 badge

---

## 八、数据库迁移

### 8.1 迁移脚本: `database/018_feedback_enhancement.sql`

**包含内容**:
1. 升级 `feedback` 顶级节点 type=2 → type=1（目录）
2. 新增 2 个二级菜单权限
3. 新增 1 个按钮权限
4. 新增 3 个 API 权限
5. admin/operator/auditor 角色权限映射
6. Seed `BUSINESS_FEEDBACK_NEW` 通知类型到 `notification_types` 表

**幂等设计**: 采用与 017 相同的模式——先删除本脚本管理的扩展权限，再重新插入。

---

## 九、文件变更清单

| 类别 | 文件路径 | 操作 | 说明 |
|------|---------|------|------|
| 后端 | `super-tool-node/app/controller/feedback.ts` | 修改 | 新增 myList, myDetail 方法 |
| 后端 | `super-tool-node/app/service/feedback.ts` | 修改 | 新增 myList, statsOverview, statsTrend, pendingCount；update() 接入通知 |
| 后端 | `super-tool-node/app/controller/admin/feedback.ts` | 修改 | 新增 statsOverview, statsTrend, pendingCount 方法 |
| 后端 | `super-tool-node/app/router.ts` | 修改 | 新增 6 条路由 |
| 后端 | `super-tool-node/database/018_feedback_enhancement.sql` | **新增** | 权限 + 通知类型 seed |
| H5 | `super-tools-web/packages/h5/micro-tools/pages/feedback/index.tsx` | **新增** | 提交页 |
| H5 | `super-tools-web/packages/h5/micro-tools/pages/feedback/index.less` | **新增** | 提交页样式 |
| H5 | `super-tools-web/packages/h5/micro-tools/pages/feedback/history/index.tsx` | **新增** | 历史页 |
| H5 | `super-tools-web/packages/h5/micro-tools/pages/feedback/history/index.less` | **新增** | 历史页样式 |
| H5 | `super-tools-web/packages/h5/micro-tools/pages/feedback/detail/[id].tsx` | **新增** | 详情页 |
| H5 | `super-tools-web/packages/h5/micro-tools/pages/feedback/detail/index.less` | **新增** | 详情页样式 |
| Admin | `super-tools-admin/src/pages/Feedback/Stats/index.tsx` | **新增** | 统计页 |
| Admin | `super-tools-admin/src/pages/Feedback/Stats/index.less` | **新增** | 统计页样式 |
| Admin | `super-tools-admin/src/services/feedback.ts` | 修改 | 新增 stats + pending API |
| Admin | `super-tools-admin/config/routes/modules/feedback.ts` | 修改 | 新增 stats 路由 |

---

## 十、实现约束

1. **图片上传**: 本期不实现，后续迭代加入
2. **通知发送**: 使用 `try/catch` 包裹，通知失败不阻塞主流程
3. **匿名反馈**: userId 为 null 时跳过通知发送
4. **状态机**: 保持现有状态转移规则不变（0→1→2/3）
5. **幂等**: SQL 迁移脚本支持重复执行
6. **性能**: 统计查询使用索引（idx_status, idx_created_at, idx_type 已建立）
7. **Badge 轮询**: 管理端 60 秒间隔，不使用 WebSocket（避免过度设计）
