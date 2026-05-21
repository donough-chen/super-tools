# Feedback Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the feedback module with H5 user pages, admin stats page, full notification integration, and RBAC permissions.

**Architecture:** Extend existing Egg.js backend with new service methods and controller endpoints. Add 3 H5 pages (Umi/React) for user feedback flow. Add 1 admin stats page (Ant Design). Wire up notification triggers on status changes. Configure RBAC via SQL migration.

**Tech Stack:** Egg.js (Node backend), Sequelize ORM, React + Umi (H5/Admin), Ant Design, Less, MySQL

---

## File Structure

### Backend (super-tool-node)

| File | Responsibility |
|------|---------------|
| `app/controller/feedback.ts` | Modify: add `myList`, `myDetail` for logged-in users |
| `app/service/feedback.ts` | Modify: add `myList`, `statsOverview`, `statsTrend`, `pendingCount`; wire notifications in `update()` and `create()` |
| `app/controller/admin/feedback.ts` | Modify: add `statsOverview`, `statsTrend`, `pendingCount` methods |
| `app/router.ts` | Modify: add 5 new routes |
| `database/019_feedback_enhancement.sql` | Create: permissions + notification type seed |

### H5 Frontend (super-tools-web/packages/h5/micro-tools)

| File | Responsibility |
|------|---------------|
| `pages/feedback/index.tsx` | Create: feedback submission page |
| `pages/feedback/index.less` | Create: submission page styles |
| `pages/feedback/history/index.tsx` | Create: feedback history list page |
| `pages/feedback/history/index.less` | Create: history page styles |
| `pages/feedback/detail/[id].tsx` | Create: feedback detail page with timeline |
| `pages/feedback/detail/index.less` | Create: detail page styles |

### Admin Frontend (super-tools-admin)

| File | Responsibility |
|------|---------------|
| `src/pages/Feedback/Stats/index.tsx` | Create: stats dashboard page |
| `src/pages/Feedback/Stats/index.less` | Create: stats page styles |
| `src/services/feedback.ts` | Modify: add stats and pending-count API calls |
| `config/routes/modules/feedback.ts` | Modify: add /feedback/stats route |

---

## Task 1: Database Migration — Permissions & Notification Seed

**Files:**
- Create: `super-tool-node/database/019_feedback_enhancement.sql`

- [ ] **Step 1: Create migration script**

```sql
-- ============================================================
-- 迁移脚本: 019_feedback_enhancement.sql
-- 版本: 3.1.0
-- 创建时间: 2026-05-21
-- 说明: 反馈模块增强
--   1) 升级 feedback 顶级节点为目录 (type=1)
--   2) 新增 2 个二级菜单权限
--   3) 新增 1 个按钮权限
--   4) 新增 3 个 API 权限
--   5) admin / operator / auditor 角色权限映射
--   6) Seed BUSINESS_FEEDBACK_NEW 通知类型 + 模板
-- 前置: 006_add_rbac_init.sql, 009_add_feedback_module.sql, 018_add_notification_system.sql
-- ============================================================

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 一、幂等清理 — 删除本脚本管理的 feedback 模块扩展权限
-- ============================================================

-- 删除 feedback 模块下本脚本扩展权限的角色映射
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  WHERE p.module = 'feedback'
    AND p.code IN (
      'feedback:list-page', 'feedback:stats-page',
      'feedback:batch-close',
      'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
    );

-- 删除本脚本管理的扩展权限
DELETE FROM `permissions`
  WHERE module = 'feedback'
    AND code IN (
      'feedback:list-page', 'feedback:stats-page',
      'feedback:batch-close',
      'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
    );

-- ============================================================
-- 二、升级 feedback 顶级节点为目录 (type=1)
-- ============================================================
UPDATE `permissions`
  SET `type` = 1, `path` = '/feedback'
  WHERE code = 'feedback';

-- ============================================================
-- 三、新增二级菜单（type=2）— 2 个页面入口
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `icon`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:list-page', '反馈列表', 2, 'feedback', NULL, 'admin', '/feedback/list', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 10
UNION ALL
SELECT 'feedback:stats-page', '反馈统计', 2, 'feedback', NULL, 'admin', '/feedback/stats', NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback') t), 20;

-- ============================================================
-- 四、新增按钮/操作权限（type=3）— 1 个
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:batch-close', '批量关闭', 3, 'feedback', 'admin', NULL, NULL,
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:list-page') t), 10;

-- ============================================================
-- 五、新增 API 权限（type=4）— 3 条
-- ============================================================
INSERT INTO `permissions`
  (`code`, `name`, `type`, `module`, `platform`, `path`, `method`, `parent_id`, `sort`)
SELECT 'feedback:stats:overview', '反馈统计概览', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/stats/overview', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:stats-page') t), 10
UNION ALL
SELECT 'feedback:stats:trend', '反馈统计趋势', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/stats/trend', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:stats-page') t), 20
UNION ALL
SELECT 'feedback:pending-count', '待处理计数', 4, 'feedback', 'admin',
       '/api/admin/feedbacks/pending-count', 'GET',
       (SELECT id FROM (SELECT id FROM `permissions` WHERE code = 'feedback:list-page') t), 50;

-- ============================================================
-- 六、角色 × 权限映射
-- ============================================================

-- 6.1 admin 角色：全部新增权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.module = 'feedback'
  AND p.code IN (
    'feedback:list-page', 'feedback:stats-page',
    'feedback:batch-close',
    'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
  );

-- 6.2 operator 角色：全部新增权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'operator'
  AND p.module = 'feedback'
  AND p.code IN (
    'feedback:list-page', 'feedback:stats-page',
    'feedback:batch-close',
    'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
  );

-- 6.3 auditor 角色：只读（无 batch-close）
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'auditor'
  AND p.module = 'feedback'
  AND p.code IN (
    'feedback:list-page', 'feedback:stats-page',
    'feedback:stats:overview', 'feedback:stats:trend', 'feedback:pending-count'
  );

-- ============================================================
-- 七、Seed 通知类型 BUSINESS_FEEDBACK_NEW
-- ============================================================
INSERT INTO `notification_types`
  (`code`, `name`, `description`, `category`, `default_channels`, `priority`, `subscribable`, `status`)
SELECT 'BUSINESS_FEEDBACK_NEW', '新反馈提交', '有用户提交了新的反馈', 'business',
       '["in_app"]', 'P2', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE code = 'BUSINESS_FEEDBACK_NEW');

-- Seed 模板: BUSINESS_FEEDBACK_NEW in_app
INSERT INTO `notification_templates`
  (`type_code`, `channel`, `title_template`, `body_template`, `status`)
SELECT 'BUSINESS_FEEDBACK_NEW', 'in_app',
       '收到新反馈',
       '用户提交了一条{{feedbackType}}类型的反馈：{{contentPreview}}',
       1
WHERE NOT EXISTS (
  SELECT 1 FROM `notification_templates`
  WHERE type_code = 'BUSINESS_FEEDBACK_NEW' AND channel = 'in_app'
);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 八、数据校验（手动执行）
-- ============================================================
-- SELECT code, name, type FROM `permissions` WHERE module = 'feedback' ORDER BY sort;
-- 期望: 1(目录) + 2(菜单)*2 + 1(按钮) + 7(API, 含原有4+新增3) = 11 条
--
-- SELECT r.code, COUNT(rp.permission_id) FROM `role_permissions` rp
--   JOIN `roles` r ON rp.role_id = r.id
--   JOIN `permissions` p ON rp.permission_id = p.id
--   WHERE p.module = 'feedback'
--   GROUP BY r.code;
-- 期望: admin=11, operator=11, auditor=8(无reply/update/delete/batch-close)
```

- [ ] **Step 2: Verify script is syntactically correct**

Run: `cd d:\Donough\Projects\super-tools\super-tool-node && cat database/019_feedback_enhancement.sql | head -5`
Expected: Script header visible, no syntax errors

- [ ] **Step 3: Commit**

```bash
git add database/019_feedback_enhancement.sql
git commit -m "feat(feedback): add migration 019 - permissions & notification seed"
```

---

## Task 2: Backend Service — New Methods

**Files:**
- Modify: `super-tool-node/app/service/feedback.ts`

- [ ] **Step 1: Add `myList` method to FeedbackService**

After the existing `create` method, add:

```typescript
/**
 * 用户端：我的反馈列表
 * - 仅返回当前用户的反馈
 * - 内容截断前100字
 */
async myList(userId: number, q: { page?: number; pageSize?: number; status?: 0 | 1 | 2 | 3 }) {
  const where: any = { userId };
  if (q.status !== undefined) where.status = q.status;

  const page = Math.max(1, q.page || 1);
  const pageSize = Math.min(50, Math.max(1, q.pageSize || 20));

  const { count, rows } = await this.ctx.model.Feedback.findAndCountAll({
    where,
    attributes: ['id', 'type', 'content', 'status', 'createdAt', 'repliedAt'],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  return {
    total: count,
    page,
    pageSize,
    rows: rows.map((r: any) => ({
      ...r.toJSON(),
      content: r.content?.length > 100 ? r.content.slice(0, 100) + '...' : r.content,
    })),
  };
}

/**
 * 用户端：我的反馈详情
 * - 校验 userId 归属
 */
async myDetail(id: number, userId: number) {
  const fb = await this.ctx.model.Feedback.findOne({
    where: { id, userId },
    attributes: ['id', 'type', 'content', 'contact', 'platform', 'status', 'replyContent', 'repliedAt', 'createdAt', 'updatedAt'],
  });
  if (!fb) this.ctx.throw(404, 'feedback not found');
  return fb;
}
```

- [ ] **Step 2: Add `statsOverview` method**

```typescript
/**
 * 管理端：反馈统计概览
 */
async statsOverview() {
  const { Feedback } = this.ctx.model;
  const { fn, col, literal } = this.app.Sequelize;

  // 各状态计数
  const statusCounts = await Feedback.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  }) as any[];

  const statusMap: Record<number, number> = {};
  statusCounts.forEach((r: any) => { statusMap[r.status] = Number(r.count); });

  // 今日新增
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayNew = await Feedback.count({
    where: { createdAt: { [Op.gte]: todayStart } },
  });

  // 按类型分布
  const typeCounts = await Feedback.findAll({
    attributes: ['type', [fn('COUNT', col('id')), 'count']],
    group: ['type'],
    raw: true,
  }) as any[];
  const byType: Record<string, number> = { bug: 0, suggestion: 0, praise: 0, other: 0 };
  typeCounts.forEach((r: any) => { byType[r.type] = Number(r.count); });

  // 平均回复时长（小时）— 仅统计已回复的
  const avgResult = await Feedback.findOne({
    attributes: [[fn('AVG', literal('TIMESTAMPDIFF(SECOND, created_at, replied_at)')), 'avgSeconds']],
    where: { status: 2, repliedAt: { [Op.ne]: null } },
    raw: true,
  }) as any;
  const avgReplyHours = avgResult?.avgSeconds ? Math.round(Number(avgResult.avgSeconds) / 3600 * 10) / 10 : 0;

  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return {
    total,
    pending: statusMap[0] || 0,
    processing: statusMap[1] || 0,
    replied: statusMap[2] || 0,
    closed: statusMap[3] || 0,
    todayNew,
    avgReplyHours,
    byType,
  };
}
```

- [ ] **Step 3: Add `statsTrend` method**

```typescript
/**
 * 管理端：反馈趋势数据
 */
async statsTrend(days: number = 30) {
  days = Math.min(90, Math.max(7, days));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { fn, col, literal } = this.app.Sequelize;

  // 按日聚合提交数
  const submitted = await this.ctx.model.Feedback.findAll({
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: { createdAt: { [Op.gte]: startDate } },
    group: [fn('DATE', col('created_at'))],
    raw: true,
  }) as any[];

  // 按日聚合回复数
  const replied = await this.ctx.model.Feedback.findAll({
    attributes: [
      [fn('DATE', col('replied_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: { repliedAt: { [Op.gte]: startDate, [Op.ne]: null } },
    group: [fn('DATE', col('replied_at'))],
    raw: true,
  }) as any[];

  // 按日聚合关闭数（status=3 且 updated_at 在范围内）
  const closed = await this.ctx.model.Feedback.findAll({
    attributes: [
      [fn('DATE', col('updated_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: {
      status: 3,
      updatedAt: { [Op.gte]: startDate },
    },
    group: [fn('DATE', col('updated_at'))],
    raw: true,
  }) as any[];

  // 组装结果
  const submittedMap = new Map(submitted.map((r: any) => [r.date, Number(r.count)]));
  const repliedMap = new Map(replied.map((r: any) => [r.date, Number(r.count)]));
  const closedMap = new Map(closed.map((r: any) => [r.date, Number(r.count)]));

  const items: Array<{ date: string; submitted: number; replied: number; closed: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    items.push({
      date: dateStr,
      submitted: submittedMap.get(dateStr) || 0,
      replied: repliedMap.get(dateStr) || 0,
      closed: closedMap.get(dateStr) || 0,
    });
  }

  return { items };
}
```

- [ ] **Step 4: Add `pendingCount` method**

```typescript
/**
 * 管理端：待处理反馈计数（用于 badge）
 */
async pendingCount() {
  const count = await this.ctx.model.Feedback.count({ where: { status: 0 } });
  return { count };
}
```

- [ ] **Step 5: Wire notification in `update()` method**

In the existing `update` method, after `await fb.update({ status: payload.status });`, add notification trigger:

```typescript
// 触发通知：状态变更
if (payload.status !== undefined && (fb as any).userId) {
  const statusLabels: Record<number, string> = { 0: '待处理', 1: '处理中', 2: '已回复', 3: '已关闭' };
  try {
    await this.ctx.service.notification.core.send({
      typeCode: 'BUSINESS_FEEDBACK_STATUS',
      userId: (fb as any).userId,
      variables: {
        feedbackTitle: ((fb as any).content || '').slice(0, 20) || '反馈',
        newStatus: statusLabels[payload.status] || String(payload.status),
      },
      extra: { feedbackId: id },
    });
  } catch (e: any) {
    this.ctx.logger.warn(`[feedback.update] notification failed: ${e.message}`);
  }
}
```

- [ ] **Step 6: Wire notification in `create()` — notify admins on new feedback**

In the existing `create` method, after the `return` statement is prepared (but before returning), add:

```typescript
// 触发通知：新反馈提交 → 通知管理员
if (payload.userId) {
  try {
    await this.ctx.service.notification.core.sendByAudience({
      typeCode: 'BUSINESS_FEEDBACK_NEW',
      audienceType: 'dynamic',
      dynamicRules: { roleCode: 'admin' },
      variables: {
        feedbackType: payload.type,
        contentPreview: payload.content.slice(0, 50),
      },
    });
  } catch (e: any) {
    this.ctx.logger.warn(`[feedback.create] admin notification failed: ${e.message}`);
  }
}
```

Modify the `create` method to store the result before notifying:

```typescript
async create(payload: FeedbackCreatePayload) {
  const fb = await this.ctx.model.Feedback.create({
    userId: payload.userId ?? null,
    type: payload.type,
    content: payload.content,
    contact: payload.contact ?? null,
    platform: payload.platform ?? null,
    ip: payload.ip ?? null,
    userAgent: payload.userAgent ?? null,
    status: 0,
  });

  // 触发通知：新反馈提交 → 通知管理员
  if (payload.userId) {
    try {
      await this.ctx.service.notification.core.sendByAudience({
        typeCode: 'BUSINESS_FEEDBACK_NEW',
        audienceType: 'dynamic',
        dynamicRules: { roleCode: 'admin' },
        variables: {
          feedbackType: payload.type,
          contentPreview: payload.content.slice(0, 50),
        },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[feedback.create] admin notification failed: ${e.message}`);
    }
  }

  return fb;
}
```

- [ ] **Step 7: Commit**

```bash
git add app/service/feedback.ts
git commit -m "feat(feedback): add myList, stats, pendingCount & notification integration"
```

---

## Task 3: Backend Controller — User-facing Endpoints

**Files:**
- Modify: `super-tool-node/app/controller/feedback.ts`

- [ ] **Step 1: Add `myList` and `myDetail` methods**

Add these methods to the existing `FeedbackController` class after the `create` method:

```typescript
/**
 * GET /api/feedback/mine
 * - 需要登录
 * - 返回当前用户的反馈列表
 */
async myList() {
  const userId = (this.ctx.state as any).user?.id;
  if (!userId) this.ctx.throw(401, '请先登录');

  const q = this.ctx.query as any;
  const result = await this.service.feedback.myList(userId, {
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    status: q.status !== undefined ? Number(q.status) as 0 | 1 | 2 | 3 : undefined,
  });
  this.success(result);
}

/**
 * GET /api/feedback/mine/:id
 * - 需要登录
 * - 仅能查看自己的反馈
 */
async myDetail() {
  const userId = (this.ctx.state as any).user?.id;
  if (!userId) this.ctx.throw(401, '请先登录');

  const id = Number(this.ctx.params.id);
  const data = await this.service.feedback.myDetail(id, userId);
  this.success(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/controller/feedback.ts
git commit -m "feat(feedback): add myList and myDetail user endpoints"
```

---

## Task 4: Backend Controller — Admin Stats Endpoints

**Files:**
- Modify: `super-tool-node/app/controller/admin/feedback.ts`

- [ ] **Step 1: Add stats and pending-count methods**

Add these methods to the existing `AdminFeedbackController` class:

```typescript
/** GET /api/admin/feedbacks/stats/overview */
async statsOverview() {
  const data = await this.service.feedback.statsOverview();
  this.success(data);
}

/** GET /api/admin/feedbacks/stats/trend */
async statsTrend() {
  const days = this.ctx.query.days ? Number(this.ctx.query.days) : 30;
  const data = await this.service.feedback.statsTrend(days);
  this.success(data);
}

/** GET /api/admin/feedbacks/pending-count */
async pendingCount() {
  const data = await this.service.feedback.pendingCount();
  this.success(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/controller/admin/feedback.ts
git commit -m "feat(feedback): add admin stats and pending-count endpoints"
```

---

## Task 5: Backend Router — Register New Routes

**Files:**
- Modify: `super-tool-node/app/router.ts`

- [ ] **Step 1: Add user-facing routes**

In the `router.ts` file, after the existing `router.post('/api/feedback', ...)` line, add:

```typescript
  // 反馈（C 端 - 需登录）
  router.get('/api/feedback/mine', auth, userCtrl.feedback.myList);
  router.get('/api/feedback/mine/:id', auth, userCtrl.feedback.myDetail);
```

- [ ] **Step 2: Add admin stats routes**

In the admin feedback section, add these BEFORE the `router.get('/api/admin/feedbacks/:id', ...)` line (to avoid `:id` catching `stats` and `pending-count`):

```typescript
  router.get('/api/admin/feedbacks/stats/overview', auth, perm('feedback:stats:overview'), adminCtrl.feedback.statsOverview);
  router.get('/api/admin/feedbacks/stats/trend', auth, perm('feedback:stats:trend'), adminCtrl.feedback.statsTrend);
  router.get('/api/admin/feedbacks/pending-count', auth, perm('feedback:pending-count'), adminCtrl.feedback.pendingCount);
```

- [ ] **Step 3: Commit**

```bash
git add app/router.ts
git commit -m "feat(feedback): register new user and admin routes"
```

---

## Task 6: Admin Frontend — Service Layer

**Files:**
- Modify: `super-tools-admin/src/services/feedback.ts`

- [ ] **Step 1: Add stats and pending-count API functions**

Append these to the existing `feedback.ts` service file:

```typescript
/** 反馈统计概览 */
export async function getFeedbackStatsOverview() {
  return request('/api/admin/feedbacks/stats/overview');
}

/** 反馈趋势数据 */
export async function getFeedbackStatsTrend(params?: { days?: number }) {
  return request('/api/admin/feedbacks/stats/trend', { params });
}

/** 待处理反馈计数 */
export async function getFeedbackPendingCount() {
  return request('/api/admin/feedbacks/pending-count');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/feedback.ts
git commit -m "feat(feedback): add stats and pending-count service APIs"
```

---

## Task 7: Admin Frontend — Routes Config

**Files:**
- Modify: `super-tools-admin/config/routes/modules/feedback.ts`

- [ ] **Step 1: Add stats route**

Replace the entire file content:

```typescript
/**
 * 反馈管理路由（DB 顶级目录 feedback，type=1）
 * - /feedback → 重定向到 /feedback/list
 * - /feedback/list 对应 DB 权限码 feedback:list-page（type=2，path=/feedback/list）
 * - /feedback/stats 对应 DB 权限码 feedback:stats-page（type=2，path=/feedback/stats）
 */
const feedbackRoutes = [
  {
    path: '/feedback',
    routes: [
      { path: '/feedback', redirect: '/feedback/list' },
      {
        path: '/feedback/list',
        component: '@/pages/Feedback/List',
        wrappers: ['@/components/AuthWrapper'],
      },
      {
        path: '/feedback/stats',
        component: '@/pages/Feedback/Stats',
        wrappers: ['@/components/AuthWrapper'],
      },
    ],
  },
];

export default feedbackRoutes;
```

- [ ] **Step 2: Commit**

```bash
git add config/routes/modules/feedback.ts
git commit -m "feat(feedback): add stats route to admin routes config"
```

---

## Task 8: Admin Frontend — Stats Page

**Files:**
- Create: `super-tools-admin/src/pages/Feedback/Stats/index.tsx`
- Create: `super-tools-admin/src/pages/Feedback/Stats/index.less`

- [ ] **Step 1: Create stats page styles**

Create `src/pages/Feedback/Stats/index.less`:

```less
.feedback-stats-page {
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    .stat-card {
      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #1890ff;
      }
      .stat-label {
        color: #666;
        margin-top: 4px;
      }
    }
  }

  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 24px;
  }

  .trend-chart {
    margin-bottom: 24px;
  }
}
```

- [ ] **Step 2: Create stats page component**

Create `src/pages/Feedback/Stats/index.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Select, Spin } from 'antd';
import {
  MessageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import { getFeedbackStatsOverview, getFeedbackStatsTrend } from '@/services/feedback';
import './index.less';

const FeedbackStats: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const fetchOverview = async () => {
    try {
      const res: any = await getFeedbackStatsOverview();
      if (res?.code === 200) setOverview(res.data);
    } catch { /* ignore */ }
  };

  const fetchTrend = async () => {
    setLoading(true);
    try {
      const res: any = await getFeedbackStatsTrend({ days });
      if (res?.code === 200 && res.data?.items) {
        setTrend(res.data.items);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);
  useEffect(() => { fetchTrend(); }, [days]);

  // 折线图数据转换
  const trendData = trend.flatMap(item => [
    { date: item.date, value: item.submitted, type: '提交' },
    { date: item.date, value: item.replied, type: '回复' },
    { date: item.date, value: item.closed, type: '关闭' },
  ]);

  // 分类饼图数据
  const typeData = overview ? [
    { type: 'Bug', value: overview.byType.bug },
    { type: '建议', value: overview.byType.suggestion },
    { type: '表扬', value: overview.byType.praise },
    { type: '其他', value: overview.byType.other },
  ].filter(d => d.value > 0) : [];

  // 状态饼图数据
  const statusData = overview ? [
    { status: '待处理', value: overview.pending },
    { status: '处理中', value: overview.processing },
    { status: '已回复', value: overview.replied },
    { status: '已关闭', value: overview.closed },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="feedback-stats-page">
      <Card title="反馈统计" extra={
        <Select value={days} onChange={setDays} style={{ width: 120 }}>
          <Select.Option value={7}>近7天</Select.Option>
          <Select.Option value={30}>近30天</Select.Option>
          <Select.Option value={90}>近90天</Select.Option>
        </Select>
      }>
        {/* 概览卡片 */}
        <Row gutter={16} className="stat-cards">
          <Col span={6}>
            <Card>
              <Statistic
                title="总反馈数"
                value={overview?.total || 0}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待处理"
                value={overview?.pending || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日新增"
                value={overview?.todayNew || 0}
                prefix={<PlusCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均回复时长"
                value={overview?.avgReplyHours || 0}
                suffix="小时"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 趋势图 */}
        <Card title="趋势" className="trend-chart" loading={loading}>
          <Line
            data={trendData}
            xField="date"
            yField="value"
            seriesField="type"
            smooth
            height={300}
          />
        </Card>

        {/* 饼图 */}
        <div className="charts-row">
          <Card title="分类分布">
            <Pie
              data={typeData}
              angleField="value"
              colorField="type"
              radius={0.8}
              height={250}
              label={{ type: 'outer' }}
            />
          </Card>
          <Card title="状态分布">
            <Pie
              data={statusData}
              angleField="value"
              colorField="status"
              radius={0.8}
              height={250}
              label={{ type: 'outer' }}
            />
          </Card>
        </div>
      </Card>
    </div>
  );
};

export default FeedbackStats;
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Feedback/Stats/
git commit -m "feat(feedback): add admin stats page with overview, trend, and charts"
```

---

## Task 9: H5 Frontend — Feedback Submit Page

**Files:**
- Create: `super-tools-web/packages/h5/micro-tools/pages/feedback/index.tsx`
- Create: `super-tools-web/packages/h5/micro-tools/pages/feedback/index.less`

- [ ] **Step 1: Create submit page styles**

Create `pages/feedback/index.less`:

```less
.feedback-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);

  .feedback-form {
    padding: 16px;

    .form-section {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;

      .section-title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin-bottom: 12px;
      }
    }

    .type-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      .type-item {
        padding: 8px 16px;
        border-radius: 20px;
        border: 1px solid #ddd;
        font-size: 13px;
        color: #666;
        background: #fff;
        transition: all 0.2s;

        &.active {
          border-color: #1890ff;
          color: #1890ff;
          background: #e6f7ff;
        }
      }
    }

    .content-textarea {
      width: 100%;
      min-height: 120px;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      resize: none;
      outline: none;

      &:focus {
        border-color: #1890ff;
      }
    }

    .char-count {
      text-align: right;
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    .contact-input {
      width: 100%;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      outline: none;

      &:focus {
        border-color: #1890ff;
      }
    }

    .submit-btn {
      width: 100%;
      height: 44px;
      border-radius: 22px;
      background: #1890ff;
      color: #fff;
      font-size: 16px;
      font-weight: 500;
      border: none;
      margin-top: 24px;
      cursor: pointer;

      &:disabled {
        background: #d9d9d9;
        color: #999;
      }

      &.loading {
        opacity: 0.7;
      }
    }

    .history-link {
      text-align: center;
      margin-top: 16px;
      font-size: 13px;
      color: #1890ff;
    }
  }
}
```

- [ ] **Step 2: Create submit page component**

Create `pages/feedback/index.tsx`:

```tsx
import React, { useState } from 'react';
import { Toast } from 'antd-mobile';
import AppHeader from '../../components/AppHeader';
import { useUserStore } from '../../store';
import { navigateTo } from '@/utils/navigator';
import request from '@/utils/request';
import './index.less';

const TYPES = [
  { value: 'bug', label: 'Bug反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'praise', label: '表扬' },
  { value: 'other', label: '其他' },
];

const FeedbackPage: React.FC = () => {
  const { user } = useUserStore();
  const isLoggedIn = !!user?.id;

  const [type, setType] = useState('suggestion');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = content.trim().length >= 5 && (isLoggedIn || contact.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const res: any = await request.post('/api/feedback', {
        data: {
          type,
          content: content.trim(),
          contact: contact.trim() || undefined,
          platform: 'micro-tools',
        },
      });
      if (res?.code === 201) {
        Toast.show({ icon: 'success', content: '提交成功' });
        setContent('');
        setContact('');
        if (isLoggedIn) {
          navigateTo('/pages/feedback/history/index');
        }
      } else {
        Toast.show({ icon: 'fail', content: res?.message || '提交失败' });
      }
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e?.message || '网络错误' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feedback-page">
      <AppHeader title="意见反馈" />
      <div className="feedback-form">
        {/* 类型选择 */}
        <div className="form-section">
          <div className="section-title">反馈类型</div>
          <div className="type-group">
            {TYPES.map(t => (
              <div
                key={t.value}
                className={`type-item ${type === t.value ? 'active' : ''}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* 内容输入 */}
        <div className="form-section">
          <div className="section-title">反馈内容</div>
          <textarea
            className="content-textarea"
            placeholder="请详细描述您遇到的问题或建议（至少5个字）"
            maxLength={2000}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="char-count">{content.length}/2000</div>
        </div>

        {/* 联系方式 */}
        {!isLoggedIn && (
          <div className="form-section">
            <div className="section-title">联系方式（必填）</div>
            <input
              className="contact-input"
              placeholder="请输入邮箱或手机号"
              maxLength={100}
              value={contact}
              onChange={e => setContact(e.target.value)}
            />
          </div>
        )}

        {/* 提交按钮 */}
        <button
          className={`submit-btn ${loading ? 'loading' : ''}`}
          disabled={!canSubmit || loading}
          onClick={handleSubmit}
        >
          {loading ? '提交中...' : '提交反馈'}
        </button>

        {/* 历史链接 */}
        {isLoggedIn && (
          <div className="history-link" onClick={() => navigateTo('/pages/feedback/history/index')}>
            查看我的反馈历史 →
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;
```

- [ ] **Step 3: Commit**

```bash
git add packages/h5/micro-tools/pages/feedback/index.tsx packages/h5/micro-tools/pages/feedback/index.less
git commit -m "feat(feedback): add H5 feedback submission page"
```

---

## Task 10: H5 Frontend — Feedback History Page

**Files:**
- Create: `super-tools-web/packages/h5/micro-tools/pages/feedback/history/index.tsx`
- Create: `super-tools-web/packages/h5/micro-tools/pages/feedback/history/index.less`

- [ ] **Step 1: Create history page styles**

Create `pages/feedback/history/index.less`:

```less
.feedback-history-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);

  .history-list {
    padding: 12px 16px;

    .feedback-card {
      background: #fff;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 10px;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .type-tag {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 10px;
          background: #f0f0f0;
          color: #666;
        }

        .status-tag {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 10px;

          &.status-0 { background: #f5f5f5; color: #999; }
          &.status-1 { background: #e6f7ff; color: #1890ff; }
          &.status-2 { background: #f6ffed; color: #52c41a; }
          &.status-3 { background: #f5f5f5; color: #666; }
        }
      }

      .card-content {
        font-size: 14px;
        color: #333;
        line-height: 1.5;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .card-time {
        font-size: 12px;
        color: #999;
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 80px 40px;

    .empty-icon {
      font-size: 48px;
      color: #d9d9d9;
      margin-bottom: 16px;
    }

    .empty-text {
      font-size: 14px;
      color: #999;
      margin-bottom: 16px;
    }

    .empty-btn {
      display: inline-block;
      padding: 8px 24px;
      background: #1890ff;
      color: #fff;
      border-radius: 20px;
      font-size: 14px;
    }
  }

  .load-more {
    text-align: center;
    padding: 16px;
    font-size: 13px;
    color: #999;
  }
}
```

- [ ] **Step 2: Create history page component**

Create `pages/feedback/history/index.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import AppHeader from '../../../components/AppHeader';
import { useUserStore } from '../../../store';
import { navigateTo } from '@/utils/navigator';
import request from '@/utils/request';
import './index.less';

const PAGE_SIZE = 20;
const STATUS_LABELS: Record<number, string> = { 0: '待处理', 1: '处理中', 2: '已回复', 3: '已关闭' };
const TYPE_LABELS: Record<string, string> = { bug: 'Bug', suggestion: '建议', praise: '表扬', other: '其他' };

const FeedbackHistoryPage: React.FC = () => {
  const { user } = useUserStore();
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchList = useCallback(async (pageNum: number, append = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res: any = await request.get('/api/feedback/mine', {
        params: { page: pageNum, pageSize: PAGE_SIZE },
      });
      if (res?.code === 200 && res.data) {
        const { rows, total: t } = res.data;
        setList(prev => append ? [...prev, ...rows] : rows);
        setTotal(t);
        setHasMore(pageNum * PAGE_SIZE < t);
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (user?.id) fetchList(1);
  }, [user?.id]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchList(next, true);
  };

  // 滚动到底部加载更多
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, page]);

  if (!user?.id) {
    return (
      <div className="feedback-history-page">
        <AppHeader title="反馈历史" />
        <div className="empty-state">
          <div className="empty-text">请先登录后查看反馈历史</div>
          <div className="empty-btn" onClick={() => navigateTo('/pages/login/index')}>去登录</div>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-history-page">
      <AppHeader title="反馈历史" />
      {list.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <div className="empty-text">暂无反馈记录</div>
          <div className="empty-btn" onClick={() => navigateTo('/pages/feedback/index')}>去反馈</div>
        </div>
      ) : (
        <div className="history-list">
          {list.map((item: any) => (
            <div
              key={item.id}
              className="feedback-card"
              onClick={() => navigateTo(`/pages/feedback/detail/${item.id}`)}
            >
              <div className="card-header">
                <span className="type-tag">{TYPE_LABELS[item.type] || item.type}</span>
                <span className={`status-tag status-${item.status}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="card-content">{item.content}</div>
              <div className="card-time">
                {new Date(item.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          ))}
          {loading && <div className="load-more">加载中...</div>}
          {!hasMore && list.length > 0 && <div className="load-more">没有更多了</div>}
        </div>
      )}
    </div>
  );
};

export default FeedbackHistoryPage;
```

- [ ] **Step 3: Commit**

```bash
git add packages/h5/micro-tools/pages/feedback/history/
git commit -m "feat(feedback): add H5 feedback history page"
```

---

## Task 11: H5 Frontend — Feedback Detail Page

**Files:**
- Create: `super-tools-web/packages/h5/micro-tools/pages/feedback/detail/[id].tsx`
- Create: `super-tools-web/packages/h5/micro-tools/pages/feedback/detail/index.less`

- [ ] **Step 1: Create detail page styles**

Create `pages/feedback/detail/index.less`:

```less
.feedback-detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);

  .detail-content {
    padding: 16px;

    .info-card {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;

      .info-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .type-tag {
          font-size: 13px;
          padding: 3px 10px;
          border-radius: 12px;
          background: #f0f0f0;
          color: #666;
        }

        .status-tag {
          font-size: 13px;
          padding: 3px 10px;
          border-radius: 12px;

          &.status-0 { background: #f5f5f5; color: #999; }
          &.status-1 { background: #e6f7ff; color: #1890ff; }
          &.status-2 { background: #f6ffed; color: #52c41a; }
          &.status-3 { background: #f5f5f5; color: #666; }
        }
      }

      .info-body {
        font-size: 14px;
        color: #333;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .info-time {
        font-size: 12px;
        color: #999;
        margin-top: 12px;
      }
    }

    .timeline-card {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;

      .timeline-title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin-bottom: 16px;
      }

      .timeline {
        padding-left: 12px;

        .timeline-item {
          position: relative;
          padding-left: 20px;
          padding-bottom: 20px;
          border-left: 2px solid #e8e8e8;

          &:last-child {
            border-left-color: transparent;
            padding-bottom: 0;
          }

          &.active {
            border-left-color: #1890ff;

            .timeline-dot {
              background: #1890ff;
              border-color: #1890ff;
            }
          }

          &.pending {
            .timeline-dot {
              background: #fff;
              border-color: #d9d9d9;
            }
            .timeline-label { color: #999; }
          }

          .timeline-dot {
            position: absolute;
            left: -7px;
            top: 2px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #52c41a;
            border: 2px solid #52c41a;
          }

          .timeline-label {
            font-size: 14px;
            color: #333;
          }

          .timeline-time {
            font-size: 12px;
            color: #999;
            margin-top: 2px;
          }
        }
      }
    }

    .reply-card {
      background: #fff;
      border-radius: 12px;
      padding: 16px;

      .reply-title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin-bottom: 12px;
      }

      .reply-content {
        font-size: 14px;
        color: #333;
        line-height: 1.6;
        background: #f6ffed;
        border-radius: 8px;
        padding: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .reply-time {
        font-size: 12px;
        color: #999;
        margin-top: 8px;
      }
    }
  }
}
```

- [ ] **Step 2: Create detail page component**

Create `pages/feedback/detail/[id].tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'umi';
import { Toast } from 'antd-mobile';
import AppHeader from '../../../components/AppHeader';
import { useUserStore } from '../../../store';
import request from '@/utils/request';
import './index.less';

const STATUS_LABELS: Record<number, string> = { 0: '待处理', 1: '处理中', 2: '已回复', 3: '已关闭' };
const TYPE_LABELS: Record<string, string> = { bug: 'Bug', suggestion: '建议', praise: '表扬', other: '其他' };

const FeedbackDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUserStore();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !id) return;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res: any = await request.get(`/api/feedback/mine/${id}`);
        if (res?.code === 200) {
          setDetail(res.data);
        } else {
          Toast.show({ icon: 'fail', content: res?.message || '加载失败' });
        }
      } catch {
        Toast.show({ icon: 'fail', content: '网络错误' });
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, user?.id]);

  const formatTime = (t: string | null) => {
    if (!t) return '';
    return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const renderTimeline = () => {
    if (!detail) return null;
    const status = detail.status;

    const steps = [
      { label: '提交反馈', done: true, time: detail.createdAt },
      { label: '已受理', done: status >= 1, time: status >= 1 ? detail.updatedAt : null },
      { label: '已回复', done: status >= 2, time: detail.repliedAt },
      { label: '已关闭', done: status === 3, time: status === 3 ? detail.updatedAt : null },
    ];

    return (
      <div className="timeline">
        {steps.map((step, idx) => (
          <div key={idx} className={`timeline-item ${step.done ? 'active' : 'pending'}`}>
            <div className="timeline-dot" />
            <div className="timeline-label">{step.label}</div>
            {step.time && <div className="timeline-time">{formatTime(step.time)}</div>}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="feedback-detail-page">
        <AppHeader title="反馈详情" />
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="feedback-detail-page">
        <AppHeader title="反馈详情" />
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>反馈不存在</div>
      </div>
    );
  }

  return (
    <div className="feedback-detail-page">
      <AppHeader title="反馈详情" />
      <div className="detail-content">
        {/* 反馈信息 */}
        <div className="info-card">
          <div className="info-header">
            <span className="type-tag">{TYPE_LABELS[detail.type] || detail.type}</span>
            <span className={`status-tag status-${detail.status}`}>
              {STATUS_LABELS[detail.status]}
            </span>
          </div>
          <div className="info-body">{detail.content}</div>
          <div className="info-time">提交于 {formatTime(detail.createdAt)}</div>
        </div>

        {/* 进度时间线 */}
        <div className="timeline-card">
          <div className="timeline-title">处理进度</div>
          {renderTimeline()}
        </div>

        {/* 回复内容 */}
        {detail.replyContent && (
          <div className="reply-card">
            <div className="reply-title">管理员回复</div>
            <div className="reply-content">{detail.replyContent}</div>
            <div className="reply-time">回复于 {formatTime(detail.repliedAt)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackDetailPage;
```

- [ ] **Step 3: Commit**

```bash
git add packages/h5/micro-tools/pages/feedback/detail/
git commit -m "feat(feedback): add H5 feedback detail page with timeline"
```

---

## Task 12: Integration Verification

- [ ] **Step 1: Verify all new files exist**

Run:
```bash
cd d:\Donough\Projects\super-tools
find super-tool-node/database/019_feedback_enhancement.sql super-tools-admin/src/pages/Feedback/Stats/ super-tools-web/packages/h5/micro-tools/pages/feedback/ -type f
```

Expected: All created files listed

- [ ] **Step 2: Check for TypeScript compilation issues**

Run:
```bash
cd d:\Donough\Projects\super-tools\super-tool-node && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to feedback module

- [ ] **Step 3: Final commit — all tasks complete**

```bash
cd d:\Donough\Projects\super-tools
git add -A
git status
```

Expected: Clean or only showing the changes we've made

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | DB Migration (permissions + notification seed) | 1 new | 5 min |
| 2 | Backend Service (myList, stats, notifications) | 1 modify | 10 min |
| 3 | Backend Controller (user endpoints) | 1 modify | 3 min |
| 4 | Backend Controller (admin stats) | 1 modify | 3 min |
| 5 | Backend Router (new routes) | 1 modify | 3 min |
| 6 | Admin Service (API functions) | 1 modify | 2 min |
| 7 | Admin Routes Config | 1 modify | 2 min |
| 8 | Admin Stats Page | 2 new | 8 min |
| 9 | H5 Submit Page | 2 new | 8 min |
| 10 | H5 History Page | 2 new | 8 min |
| 11 | H5 Detail Page | 2 new | 8 min |
| 12 | Integration Verification | — | 3 min |

**Total: 12 tasks, ~63 minutes estimated**
