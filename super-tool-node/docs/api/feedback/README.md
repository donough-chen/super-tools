# 反馈接口文档

> 模块：`feedback`  |  接口数：6（C 端 1 + 管理端 5）  |  Spec-A2

## 一、概述

用户反馈系统，包含 C 端提交入口和管理端 CRUD（回复 / 状态变更 / 软删）。

**核心特性**：
- C 端支持匿名 / 登录两种提交模式；IP 限流 10 req/h
- 管理端严格状态机：0/1 → 2（reply 独占）；禁止跳过"重新打开"的 transition
- 所有管理端写操作走 Spec-A1 `audit_logs` 审计
- 软删（paranoid）：列表自动过滤已删条目

## 二、状态机

| 值 | 含义 | 可迁出到 |
|---|---|---|
| 0 | 待处理 | 1, 2(via reply), 3 |
| 1 | 处理中 | 0, 2(via reply), 3 |
| 2 | 已回复 | 1（重新打开） |
| 3 | 已关闭 | 1（重新打开） |

**禁止 transitions**：2→0, 2→3, 3→0, 3→2（避免跳过"重新打开"语义）

## 三、C 端接口

### 3.1 POST /api/feedback — 提交反馈

**鉴权：** 可选（有 token 则解析 userId；无 token 按匿名）
**限流：** 10 req/h/IP（超出 429）

**Headers：**
- `Authorization: Bearer <token>` — 可选

**Body：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| type | string | ✅ | `bug` / `suggestion` / `praise` / `other` |
| content | string | ✅ | 5-2000 字符 |
| contact | string | 未登录时必填 | 联系方式（邮箱/手机等），最长 100 字符 |
| platform | string | 推荐 | 来源标识：`admin` / `tool-box` / `micro-tools` |

**Response 201：**
```json
{
  "code": 201,
  "data": { "id": 123 }
}
```

**错误：**
- 422 参数错误 / 未登录且 contact 为空
- 429 超出限流

## 四、管理端接口

### 4.1 GET /api/admin/feedbacks — 列表

**权限码：** `feedback:list`

**Query（全部可选）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| page | int | 默认 1 |
| pageSize | int | 默认 20，max 100 |
| type | string | bug / suggestion / praise / other |
| status | 0-3 | 状态过滤 |
| platform | string | 来源过滤 |
| userId | int | 指定用户 |
| keyword | string | content LIKE |
| startTime, endTime | ISO 8601 | 时间范围 |

**Response：**
```json
{
  "code": 200,
  "data": {
    "total": 52, "page": 1, "pageSize": 20,
    "rows": [{
      "id": 42, "userId": 5, "type": "bug", "content": "...",
      "contact": "a@b.com", "platform": "tool-box",
      "status": 0, "replyContent": null, "replyUserId": null, "repliedAt": null,
      "createdAt": "...",
      "user": { "id": 5, "username": "alice", "nickname": "Alice" }
    }]
  }
}
```

> 匿名条目 / 已注销用户的 `user` 字段为 `null`。

### 4.2 GET /api/admin/feedbacks/:id — 详情

**权限码：** `feedback:detail`
**Response：** 单条，含 `user` + `replier` 两个关联对象。

### 4.3 POST /api/admin/feedbacks/:id/reply — 回复

**权限码：** `feedback:reply`
**Body：** `{ replyContent: string (1-2000) }`

**Response 200：** 更新后的 feedback 对象（status=2, replyContent, replyUserId, repliedAt 已填）

**错误：**
- 404 反馈不存在
- 409 `反馈当前状态不允许回复（status=2/3），请先重新打开`

### 4.4 PUT /api/admin/feedbacks/:id — 状态变更

**权限码：** `feedback:update`
**Body：** `{ status: 0|1|2|3 }`

**Response 200：** 更新后 feedback

**错误：**
- 404 反馈不存在
- 422 `不允许的状态转移：<from> → <to>`（见 §二 禁止 transitions）
- 422 status 非 0/1/2/3

> 特例：`0/1 → 2` 必须通过 `POST /reply` 接口，本接口禁止；使用此接口 422。

### 4.5 DELETE /api/admin/feedbacks/:id — 软删

**权限码：** `feedback:delete`
**Response 200：** 无 body。DB 中 `deleted_at` 被设置，list/detail 不再返回该条。

## 五、审计

所有管理端写操作（reply/update/destroy）走 Spec-A1 `audit_logs`：

| action | 触发 | before/after |
|---|---|---|
| reply | POST /reply | before=详情 / after=更新后 |
| update | PUT /:id | 同上 |
| delete | DELETE /:id | before=详情 / after=null |

查询：`GET /api/admin/audit-logs?module=feedback`

## 六、相关文档

- [Spec-A2 设计文档](../../superpowers/specs/2026-05-11-反馈与数据统计设计文档.md)
- [Spec-A2 实施计划](../../superpowers/plans/2026-05-11-反馈与数据统计实施计划.md)
- [feedbacks 表定义](../../../database/009_add_feedback_module.sql)
