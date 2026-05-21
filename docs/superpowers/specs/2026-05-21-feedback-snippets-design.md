# 反馈回复常用话术管理 设计规范

## 文档信息
- **版本**: 1.0.0
- **创建时间**: 2026-05-21
- **状态**: 已确认
- **依赖**: 反馈模块（009_add_feedback_module.sql, 019_feedback_enhancement.sql）

---

## 一、项目背景与目标

### 1.1 现状

当前反馈管理系统已具备完整的处理流程（提交 → 审核 → 回复 → 关闭 + 通知集成）。
但回复界面（`DetailDrawer.tsx`）仅有一个纯文本 `Input.TextArea`，每次回复都需要手动输入，存在以下痛点：

- **效率低**：常见问题需要重复打字
- **质量不一**：不同管理员对同类问题的回复用词不统一
- **没有沉淀**：好的回复样板没法复用

### 1.2 目标

建立一套完整的话术库系统，覆盖以下能力：
1. 话术 CRUD + 树形分类 + 关键词标签
2. 反馈回复界面集成话术快速插入
3. 智能推荐（基于反馈类型和内容关键词）
4. 个人收藏与角色级访问限定
5. 使用频率统计 + 满意度评估
6. 批量导入导出
7. 变量替换（如 `{{userName}}`、`{{feedbackId}}`）
8. 版本管理（草稿 → 发布 → 历史回滚）

---

## 二、整体架构

```
管理端（admin）                    后端（Egg）                          数据库
┌────────────────────┐           ┌──────────────────────┐            ┌──────────────────────┐
│ /feedback/snippets │ → 列表/管理 │ controller/admin/    │            │ feedback_snippet_     │
│ - 分类树           │           │   feedback/snippet   │  ← CRUD →  │   categories          │
│ - 编辑 Drawer      │           │   feedback/          │            │ feedback_snippets     │
│ - 导入/导出        │           │     snippet_category │            │ feedback_snippet_     │
│ - 版本时间线       │           │ service/feedback/    │            │   versions            │
├────────────────────┤           │   snippet            │            │ feedback_snippet_     │
│ DetailDrawer 回复区│           │   snippet_category   │            │   usage_logs          │
│ + SnippetPicker    │ → 一键插入  │ service/feedback    │            │ feedback_snippet_     │
└────────────────────┘           │   .reply (hook)      │            │   role_permissions    │
                                 └──────────────────────┘            └──────────────────────┘
```

---

## 三、数据模型

### 3.1 `feedback_snippet_categories`（话术分类，树形）

镜像 `notification_types` 的 `parent_id` 树形模式。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT UNSIGNED PK AUTO_INCREMENT | 主键 |
| `parent_id` | BIGINT UNSIGNED NULL | 父分类，NULL=顶级 |
| `code` | VARCHAR(64) NOT NULL | 业务编码（uk: code, deleted_at） |
| `name` | VARCHAR(50) NOT NULL | 分类名 |
| `description` | VARCHAR(255) NULL | 描述 |
| `feedback_type` | VARCHAR(20) NULL | 关联反馈类型 bug/suggestion/praise/other |
| `icon` | VARCHAR(64) NULL | UI 图标标识 |
| `color` | VARCHAR(16) NULL | 主题色 |
| `sort_order` | INT NOT NULL DEFAULT 0 | 排序 |
| `status` | TINYINT(1) NOT NULL DEFAULT 1 | 0禁用 1启用 |
| `is_system` | TINYINT(1) NOT NULL DEFAULT 0 | 系统预置不可删 |
| `created_at` / `updated_at` / `deleted_at` | DATETIME | timestamps + paranoid |

**索引**：
- `UNIQUE KEY uk_code (code, deleted_at)`
- `KEY idx_parent (parent_id)`
- `KEY idx_status (status)`

### 3.2 `feedback_snippets`（话术模板）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `category_id` | BIGINT UNSIGNED NOT NULL | 关联分类 |
| `code` | VARCHAR(64) NOT NULL | 业务编码（uk: code, deleted_at） |
| `title` | VARCHAR(100) NOT NULL | 标题 |
| `content` | TEXT NOT NULL | 话术正文，支持 `{{varName}}` |
| `tags` | VARCHAR(255) NULL | 关键词标签，管道分隔 `'退款\|订单\|延迟'`（沿用 `tools.keyword` 模式） |
| `sample_variables` | JSON NULL | 变量样本，用于预览 |
| `current_version` | INT NOT NULL DEFAULT 1 | 当前已发布版本号 |
| `status` | TINYINT(1) NOT NULL DEFAULT 0 | 0草稿 / 1已发布 / 2已停用 |
| `usage_count` | INT NOT NULL DEFAULT 0 | 累计使用次数 |
| `last_used_at` | DATETIME NULL | 最近使用时间 |
| `description` | VARCHAR(500) NULL | 备注 |
| `created_by` / `updated_by` | BIGINT UNSIGNED | 操作人 |
| `created_at` / `updated_at` / `deleted_at` | DATETIME | timestamps + paranoid |

**索引**：
- `UNIQUE KEY uk_code (code, deleted_at)`
- `KEY idx_category_status (category_id, status)`
- `KEY idx_usage (usage_count)`（DESC 查询用）
- `KEY idx_last_used (last_used_at)`

### 3.3 `feedback_snippet_versions`（版本快照）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `snippet_id` | BIGINT UNSIGNED NOT NULL | 关联话术 |
| `version` | INT NOT NULL | 版本号 |
| `title` | VARCHAR(100) NOT NULL | 标题快照 |
| `content` | TEXT NOT NULL | 内容快照 |
| `tags` | VARCHAR(255) NULL | 标签快照 |
| `sample_variables` | JSON NULL | 变量样本快照 |
| `change_note` | VARCHAR(500) NULL | 变更说明 |
| `published_by` | BIGINT UNSIGNED NOT NULL | 发布人 |
| `published_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 发布时间 |

**索引**：
- `UNIQUE KEY uk_snippet_version (snippet_id, version)`

### 3.4 `feedback_snippet_usage_logs`（使用记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `snippet_id` | BIGINT UNSIGNED NOT NULL | 话术 |
| `feedback_id` | BIGINT UNSIGNED NOT NULL | 关联反馈 |
| `user_id` | BIGINT UNSIGNED NOT NULL | 操作人（管理员） |
| `final_content` | TEXT NULL | 实际发出的回复内容（用于"模板修改度"分析，可选） |
| `feedback_status_after` | TINYINT NULL | 最终反馈状态：2 已回复 / 3 已关闭（满意度代理指标） |
| `created_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | 使用时间 |

**索引**：
- `KEY idx_snippet_created (snippet_id, created_at)`
- `KEY idx_feedback (feedback_id)`
- `KEY idx_user_created (user_id, created_at)`

### 3.5 `feedback_snippet_role_permissions`（角色访问限定，多对多）

| 字段 | 类型 | 说明 |
|---|---|---|
| `category_id` | BIGINT UNSIGNED NOT NULL | 分类 ID |
| `role_id` | BIGINT UNSIGNED NOT NULL | 角色 ID |

**索引**：
- `PRIMARY KEY (category_id, role_id)`
- `KEY idx_role (role_id)`

**默认行为**：未配置该分类的任何 role_permissions 记录时，所有角色（拥有 `feedback:snippet:use` 权限的）都可访问。

### 3.6 满意度评估方案

项目当前没有显式的"用户满意度打分"。本设计采用代理指标：
- **关闭率** = 用过该话术的反馈中，最终 status=3（已关闭）的比例
- 关闭率越高 → 该话术解决问题的可能性越高 → 话术效果越好

**`feedback_status_after` 字段的同步策略**：
- **使用时**（`POST /usage`）：写入 `feedback_status_after = 2`（已回复，因为 reply 后 status 一定是 2）
- **状态变更时**（`feedback.update()` service 钩子）：当反馈 status 变为 3（已关闭）时，异步执行
  ```sql
  UPDATE feedback_snippet_usage_logs
    SET feedback_status_after = 3
    WHERE feedback_id = ? AND feedback_status_after < 3
  ```
- **回滚时**（status 从 3 → 1）：清回 2，公平计算关闭率
- 关闭率计算（统计接口）：`COUNT(status_after=3) / COUNT(*)` per snippet

---

## 四、后端 API 设计

### 4.1 分类管理

| 方法 | 路由 | 描述 | 权限码 |
|---|---|---|---|
| GET | `/api/admin/feedback/snippet-categories` | 分类树 | `feedback:snippet:category:list` |
| POST | `/api/admin/feedback/snippet-categories` | 新建分类 | `feedback:snippet:category:manage` |
| PUT | `/api/admin/feedback/snippet-categories/:id` | 编辑分类 | `feedback:snippet:category:manage` |
| DELETE | `/api/admin/feedback/snippet-categories/:id` | 删除（仅当下无话术） | `feedback:snippet:category:manage` |
| PUT | `/api/admin/feedback/snippet-categories/:id/role-permissions` | 配置角色访问 | `feedback:snippet:category:manage` |

### 4.2 话术 CRUD（草稿 + 版本发布）

| 方法 | 路由 | 描述 | 权限码 |
|---|---|---|---|
| GET | `/api/admin/feedback/snippets` | 分页列表 | `feedback:snippet:view` |
| GET | `/api/admin/feedback/snippets/:id` | 详情 | `feedback:snippet:view` |
| POST | `/api/admin/feedback/snippets` | 新建（草稿） | `feedback:snippet:manage` |
| PUT | `/api/admin/feedback/snippets/:id` | 编辑（仅草稿可编辑） | `feedback:snippet:manage` |
| DELETE | `/api/admin/feedback/snippets/:id` | 软删 | `feedback:snippet:manage` |
| POST | `/api/admin/feedback/snippets/:id/publish` | 发布草稿（生成版本快照） | `feedback:snippet:publish` |
| POST | `/api/admin/feedback/snippets/:id/disable` | 停用 | `feedback:snippet:publish` |

**列表筛选维度**：
- `categoryId` / `status` / `keyword`（title + content + tags LIKE）/ `tag` / `createdBy`
- 排序：`updated_at DESC`（默认）/ `usage_count DESC`

### 4.3 版本管理

| 方法 | 路由 | 描述 | 权限码 |
|---|---|---|---|
| GET | `/api/admin/feedback/snippets/:id/versions` | 版本历史 | `feedback:snippet:view` |
| POST | `/api/admin/feedback/snippets/:id/rollback/:versionId` | 回滚指定版本 | `feedback:snippet:publish` |

### 4.4 使用功能（在反馈回复时调用）

| 方法 | 路由 | 描述 | 权限码 |
|---|---|---|---|
| GET | `/api/admin/feedback/snippets/picker` | 当前用户可见的话术（按角色过滤+分类分组） | `feedback:snippet:use` |
| GET | `/api/admin/feedback/snippets/recommend?feedbackId=xx&limit=5` | 智能推荐 Top N | `feedback:snippet:use` |
| POST | `/api/admin/feedback/snippets/:id/render` | 用变量渲染预览 | `feedback:snippet:view` |
| POST | `/api/admin/feedback/snippets/:id/usage` | 记录使用 | `feedback:snippet:use` |

### 4.5 统计

| 方法 | 路由 | 描述 | 权限码 |
|---|---|---|---|
| GET | `/api/admin/feedback/snippets/stats/overview` | 概览（总数/月使用/活跃/平均关闭率） | `feedback:snippet:stats` |
| GET | `/api/admin/feedback/snippets/stats/top` | 使用次数 Top 10 + 关闭率 | `feedback:snippet:stats` |
| GET | `/api/admin/feedback/snippets/stats/trend` | 按日趋势 | `feedback:snippet:stats` |
| GET | `/api/admin/feedback/snippets/stats/by-category` | 按分类分布 | `feedback:snippet:stats` |

### 4.6 导入/导出

| 方法 | 路由 | 描述 | 权限码 |
|---|---|---|---|
| GET | `/api/admin/feedback/snippets/export` | 导出 JSON（含分类） | `feedback:snippet:import-export` |
| POST | `/api/admin/feedback/snippets/import` | 上传 JSON 导入（事务，按 code 幂等） | `feedback:snippet:import-export` |

**JSON 导出格式**：
```json
{
  "version": "1.0.0",
  "exportedAt": "2026-05-21T...",
  "categories": [{ "code": "...", "name": "...", "parentCode": null, ... }],
  "snippets": [{ "code": "...", "categoryCode": "...", "title": "...", "content": "...", "tags": "...", ... }]
}
```

**导入策略**：
- 按 `code` 去重：已存在则更新（仅当 status=0 草稿时），否则跳过
- 全部在事务中执行，任一条失败回滚
- 上限 500 条 / 文件 5MB

---

## 五、智能推荐算法

### 5.1 算法

```
推荐得分 = 0.4 × 类型匹配 + 0.4 × 标签匹配 + 0.15 × 全局热度 + 0.05 × 个人偏好

具体规则：
1. 类型匹配：分类的 feedback_type === 反馈.type → 1.0
2. 标签匹配：从反馈 content 提取关键词，每个关键词若命中话术 tags → +0.5（上限 1.0）
3. 全局热度：snippet.usage_count / max(usage_count) 归一化
4. 个人偏好：当前用户最近 30 天用过 → 1.0
```

**关键词提取**（不引入 jieba）：
- 反馈 content 按标点切分（。，；！？\n 等）
- 过滤停用词（"的、了、是、我、你、一、有、不、就"等约 30 个）
- 取长度 ≥ 2 的中文片段或字母数字片段
- 上限 10 个关键词

### 5.2 SQL 实现

```sql
SELECT s.*,
  (CASE WHEN c.feedback_type = ? THEN 0.4 ELSE 0 END) +
  (匹配关键词数 / 关键词总数 * 0.4) +
  (s.usage_count / (SELECT MAX(usage_count) FROM feedback_snippets) * 0.15) +
  (CASE WHEN EXISTS(...usage_logs...) THEN 0.05 ELSE 0 END) AS score
FROM feedback_snippets s
JOIN feedback_snippet_categories c ON c.id = s.category_id
WHERE s.status = 1 AND s.deleted_at IS NULL
ORDER BY score DESC LIMIT ?
```

### 5.3 缓存策略

不上缓存（YAGNI）。后续如慢，可加 5 分钟 Redis TTL。

---

## 六、变量替换

### 6.1 变量语法

复用项目已有的 Mustache 风格 `{{varName}}`，直接复用 `app/lib/templateRenderer`（参见 `notification/template.ts`）。

### 6.2 内置变量（自动注入）

| 变量名 | 来源 |
|---|---|
| `{{userName}}` | feedback.user.nickname \|\| username \|\| '用户' |
| `{{feedbackId}}` | feedback.id |
| `{{feedbackType}}` | bug→Bug / suggestion→建议 / praise→表扬 / other→其他 |
| `{{adminName}}` | 当前管理员 nickname \|\| username |
| `{{currentDate}}` | YYYY-MM-DD |

### 6.3 自定义变量

由用户在 `sample_variables` JSON 中预定义占位（如 `{ orderNo: '订单号', refundAmount: '退款金额' }`）。

**前端使用流程**：
1. 用户选中话术 → 前端 `extractVars(content)` 抓出所有 `{{xxx}}`
2. 内置变量直接由后端 `/render` 接口填入
3. 自定义变量（非内置）→ 前端弹小表单让用户填写
4. 前端本地用 simple replacer 替换占位符 → 写入 TextArea

---

## 七、RBAC 权限设计

### 7.1 权限层次

```
feedback (一级目录, type=1)
└── feedback:snippet (二级目录, type=1, path=/feedback/snippets)        ← 新增
    ├── feedback:snippet-page (菜单, type=2, path=/feedback/snippets)
    │   ├── feedback:snippet:view (API, type=4)
    │   ├── feedback:snippet:manage (按钮, type=3)
    │   ├── feedback:snippet:publish (按钮, type=3)
    │   ├── feedback:snippet:use (按钮, type=3)
    │   ├── feedback:snippet:import-export (按钮, type=3)
    │   ├── feedback:snippet:category:list (API, type=4)
    │   └── feedback:snippet:category:manage (API, type=4)
    └── feedback:snippet-stats-page (菜单, type=2, path=/feedback/snippets/stats)
        └── feedback:snippet:stats (API, type=4)
```

### 7.2 角色 × 权限矩阵

| 权限码 | admin | operator | auditor |
|---|:---:|:---:|:---:|
| `feedback:snippet`（二级目录） | ✅ | ✅ | ✅ |
| `feedback:snippet-page` | ✅ | ✅ | ✅ |
| `feedback:snippet-stats-page` | ✅ | ✅ | ✅ |
| `feedback:snippet:view` | ✅ | ✅ | ✅ |
| `feedback:snippet:use` | ✅ | ✅ | ❌ |
| `feedback:snippet:manage` | ✅ | ✅ | ❌ |
| `feedback:snippet:publish` | ✅ | ❌ | ❌ |
| `feedback:snippet:import-export` | ✅ | ❌ | ❌ |
| `feedback:snippet:stats` | ✅ | ✅ | ✅ |
| `feedback:snippet:category:list` | ✅ | ✅ | ✅ |
| `feedback:snippet:category:manage` | ✅ | ✅ | ❌ |

### 7.3 分类级别访问限定

`feedback:snippet:use` 是开关。具体能用哪些分类下的话术，由 `feedback_snippet_role_permissions` 表细粒度控制：
- 配置了 → 仅当用户角色 ID 在分类的允许列表中可见
- 未配置 → 默认所有角色可见

---

## 八、前端 UI 设计

### 8.1 路由

```
/feedback
  ├── /feedback/list             （已有）
  ├── /feedback/stats            （已有）
  ├── /feedback/snippets         ← 新增
  └── /feedback/snippets/stats   ← 新增
```

### 8.2 话术管理页 `/feedback/snippets`

**布局**：左侧分类树（width=240）+ 右侧话术列表

```
┌────────────────────────────────────────────────────────────────┐
│ [新建分类] [新建话术] [导入] [导出]            [搜索框]         │
├──────────────┬─────────────────────────────────────────────────┤
│ 📁 分类树    │ 状态:[全部▼] 标签:[多选▼]              [刷新]  │
│ ▼ 售后       │ ┌──────────────────────────────────────────┐   │
│   • 退款流程 │ │ Table                                     │   │
│   • 物流问题 │ │ 标题  分类  标签  状态  使用次数  最近使用 │   │
│ ▼ 投诉       │ │ ─────────────────────────────────────── │   │
│ ▼ 表扬       │ │ ...                                      │   │
│ + 新建分类   │ │ 操作: [详情] [编辑] [发布] [版本] [删除] │   │
└──────────────┴────────────────────────────────────────────────┘
```

**核心交互**：
- 左树支持拖拽排序、右键菜单（编辑/删除/角色权限）
- 右表单击行展开预览（变量高亮）
- 编辑 Drawer (width=720)：双步表单（基础信息 → 内容编辑+变量识别+实时预览）
- 版本 Drawer：Timeline 展示历史版本，每版可"查看 diff"和"回滚"

### 8.3 话术统计页 `/feedback/snippets/stats`

```
┌────────────────────────────────────────────────────────────────┐
│ 时间范围 [近30天▼]                              [刷新]         │
├────────────────────────────────────────────────────────────────┤
│ [话术总数] [本月使用] [活跃话术] [平均关闭率]                  │
├────────────────────────────────────────────────────────────────┤
│ 热门话术 Top 10           │ 使用趋势折线图                     │
├────────────────────────────────────────────────────────────────┤
│ 按分类分布饼图            │ 关闭率排行                         │
└────────────────────────────────────────────────────────────────┘
```

### 8.4 SnippetPicker 组件

集成到 `pages/Feedback/List/DetailDrawer.tsx` 的回复 Form。在 TextArea 上方插入操作行：

```
┌──────────────────────────────────────────────────────────────┐
│ 回复内容 *                                                    │
│ [💡 智能推荐] [📋 选择话术] [🔍 搜索话术]                    │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ <Input.TextArea />                                        ││
│ └──────────────────────────────────────────────────────────┘│
│ 0/2000                                                       │
└──────────────────────────────────────────────────────────────┘
```

**三个入口**：
1. **💡 智能推荐**（Popover）：基于当前反馈推荐 Top 5 话术
2. **📋 选择话术**（Modal/Drawer）：完整话术库浏览
3. **🔍 搜索话术**（输入框）：实时匹配 tags/title

**变量替换流程**：
1. 选中话术 → 调 `/render` 接口预渲染内置变量
2. 检测自定义变量 → 弹表单填写
3. 完整渲染 → 写入 TextArea
4. 调 `/usage` 接口记录使用（snippetId 同时存到 form 暂存，reply 时上传）

---

## 九、状态机与生命周期

### 9.1 话术发布生命周期

```
草稿(0) ──发布──> 已发布(1) ──停用──> 已停用(2)
   ↑                  │                    │
   │                  └──版本回滚──────────┘
   │                          │
   └──── 编辑只在草稿状态 ─────┘
```

- **已发布**话术不可直接编辑——需点"创建新版本"复制内容到草稿态修改后再发布
- **回滚**：备份当前 active 版本到 versions 表（如未备份），再用目标版本内容覆盖话术主表，currentVersion 自增
- 全程在事务中执行

### 9.2 数据软删除

- 4 张表（除 `feedback_snippet_role_permissions`）`paranoid: true`
- `(code, deleted_at)` 联合唯一约束——支持软删后重建同 code
- 删除分类前校验：分类下还有未软删话术则拒绝（422）

---

## 十、文件变更清单

### 10.1 后端（super-tool-node）

| 类别 | 文件 | 操作 |
|---|---|---|
| Migration | `database/020_add_feedback_snippets.sql` | **新增** |
| Model | `app/model/feedback_snippet_category.ts` | 新增 |
| Model | `app/model/feedback_snippet.ts` | 新增 |
| Model | `app/model/feedback_snippet_version.ts` | 新增 |
| Model | `app/model/feedback_snippet_usage_log.ts` | 新增 |
| Service | `app/service/feedback/snippet.ts` | 新增（含推荐/渲染/使用记录/统计/导入导出） |
| Service | `app/service/feedback/snippet_category.ts` | 新增 |
| Controller | `app/controller/admin/feedback/snippet.ts` | 新增 |
| Controller | `app/controller/admin/feedback/snippet_category.ts` | 新增 |
| Service hook | `app/service/feedback.ts` | **修改**：reply 接受可选 `snippetId`，调用 snippetService.recordUsage |
| Service hook | `app/service/feedback.ts:update()` | **修改**：状态变 3 时同步 usage_logs.feedback_status_after |
| Router | `app/router.ts` | 修改：注册约 18 条新路由 |

### 10.2 管理端（super-tools-admin）

| 类别 | 文件 | 操作 |
|---|---|---|
| Service | `src/services/feedbackSnippet.ts` | 新增 |
| Routes | `config/routes/modules/feedback.ts` | 修改：新增 2 子路由 |
| Page | `src/pages/Feedback/Snippets/index.tsx` + `.less` | 新增：管理主页 |
| Page | `src/pages/Feedback/Snippets/CategoryTree.tsx` | 新增 |
| Page | `src/pages/Feedback/Snippets/SnippetEditDrawer.tsx` | 新增 |
| Page | `src/pages/Feedback/Snippets/VersionHistoryDrawer.tsx` | 新增 |
| Page | `src/pages/Feedback/Snippets/CategoryRolePermDrawer.tsx` | 新增 |
| Page | `src/pages/Feedback/Snippets/Stats/index.tsx` + `.less` | 新增 |
| Component | `src/components/SnippetPicker/index.tsx` + `.less` | 新增 |
| Integration | `src/pages/Feedback/List/DetailDrawer.tsx` | **修改**：集成 SnippetPicker |
| Utils | `src/utils/snippetVars.ts` | 新增（变量提取/本地渲染） |

---

## 十一、防误用约束与校验

| 项 | 上限/规则 |
|---|---|
| 话术 code | VARCHAR(64)，发布前必填 |
| title | 1~100 字符 |
| content | 10~5000 字符 |
| 标签数量 | ≤ 10 个 |
| 单标签长度 | ≤ 20 字符 |
| 单次导入条数 | ≤ 500 |
| 单次导入文件 | ≤ 5MB |
| 分类 name 长度 | 1~50 字符 |
| 已发布话术不可直接编辑 | 必须先创建新版本草稿 |
| 删除分类 | 当下有未软删话术时拒绝（422） |

所有 CRUD 接入现有 `service.audit.log`（module='feedback-snippet'）。

---

## 十二、数据规模与性能

### 12.1 1 年数据规模预估

| 表 | 规模 |
|---|---|
| `feedback_snippet_categories` | < 100 |
| `feedback_snippets` | < 1000 |
| `feedback_snippet_versions` | < 5000 |
| `feedback_snippet_usage_logs` | < 100,000 |
| `feedback_snippet_role_permissions` | < 500 |

### 12.2 性能要点

- 推荐接口：依赖 `idx_category_status` + 限制候选集（先按 category.feedback_type 预过滤）
- 排行榜：`ORDER BY usage_count DESC LIMIT 10` 走 `idx_usage`
- 分类树：一次 SELECT 全部 + 前端组装树
- 变量提取：客户端正则
- 导入文件：大小 + 条数双重限制防 OOM

---

## 十三、与现有模块的关系

| 模块 | 关系 |
|---|---|
| `feedback`（反馈管理） | 父模块；DetailDrawer 集成 SnippetPicker；reply() 钩子记录使用 |
| `notification` | 独立——不要混淆"反馈回复话术（管理端给用户的回复样板）"和"通知模板（站内信/邮件模板）" |
| `template-renderer lib` | 复用——变量替换共享 `app/lib/templateRenderer` |
| `audit-log` | 复用——CRUD 接入审计 |
| RBAC | 复用——权限码遵循现有命名规范 |

---

## 十四、不在本次范围

虽然需求要"完整版"实现 8 项，以下边界明确：

| 项 | 不实现的部分 | 理由 |
|---|---|---|
| 智能推荐 | 不引入 jieba/embedding | 关键词覆盖足够 80% 场景 |
| 富文本 | 仍用纯文本 + Mustache | 与现有 reply 体系一致；项目无富文本依赖 |
| 满意度 | 不做用户打分系统 | 用关闭率作为代理指标 |
| 实时协作编辑 | 不支持多人同时编辑同一话术 | YAGNI；用乐观锁（updated_at）防覆盖 |
| AI 生成话术 | 不集成 LLM | 超出本次范围 |
