# 审计日志接口文档

> 模块：`system:audit-log`  |  接口数：3  |  Spec-A1（v2.8）

## 一、概述

提供后台审计日志的查询、详情、CSV 导出能力。所有需要追溯的高敏感写操作（角色 / 权限 / 工具 / 分类 / 用户 / 会员）已在 controller 层调用 `service.audit.log()` 写入 `audit_logs` 表。

**写入策略**：
- 仅写操作（POST / PUT / DELETE）记录审计；GET 不审计
- 失败也写入（status=0 + failReason），便于追溯尝试性操作
- 审计写入失败不影响主业务（service 内部 try/catch + logger.warn）

## 二、接口清单

| 方法 | 路径 | 权限码 | 说明 |
|------|------|--------|------|
| GET  | `/api/admin/audit-logs` | `system:audit-log:list` | 列表查询（7 维过滤 + 分页） |
| GET  | `/api/admin/audit-logs/:id` | `system:audit-log:detail` | 单条详情（含完整 before/after JSON） |
| GET  | `/api/admin/audit-logs/export` | `system:audit-log:export` | 同步 CSV 导出（≤10000 行） |

## 三、接口详情

### 3.1 列表查询

**GET** `/api/admin/audit-logs`

**Query 参数：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `page` | int | 页码（默认 1） |
| `pageSize` | int | 每页数量（默认 20，max 100） |
| `startTime` | ISO 8601 | 时间范围起 |
| `endTime` | ISO 8601 | 时间范围止 |
| `userId` | int | 操作用户 |
| `module` | string | 模块（如 tool / role / user / member / category / permission） |
| `action` | string | 动作（见 §四） |
| `status` | 0 \| 1 | 0=失败 1=成功 |
| `keyword` | string | description LIKE 模糊搜索 |

**Response（成功）：**
```json
{
  "code": 200,
  "data": {
    "total": 152,
    "page": 1,
    "pageSize": 20,
    "rows": [
      {
        "id": 152, "userId": 1, "username": "admin",
        "module": "tool", "action": "delete", "bizType": "tool", "bizId": "5",
        "description": "删除工具 #5", "ip": "127.0.0.1",
        "requestUrl": "/api/admin/tools/5", "requestMethod": "DELETE",
        "responseCode": 200, "costTime": 35, "status": 1, "failReason": null,
        "createdAt": "2026-05-11T03:14:22.000Z"
      }
    ]
  }
}
```

> **列表响应不含** `beforeData / afterData / requestParams`（避免响应过大），需要 JSON 详情请用 3.2。

### 3.2 单条详情

**GET** `/api/admin/audit-logs/:id`

**Response：** 同 3.1 的 row 字段，**额外含** `beforeData / afterData / requestParams` 三个 JSON 字段。

### 3.3 CSV 导出

**GET** `/api/admin/audit-logs/export`

**Query：** 同 3.1（不含 page/pageSize），可选 `max`（默认 10000，硬上限 10000）。

**Response：** CSV 文件流。
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="audit-logs-<timestamp>.csv"`
- UTF-8 BOM 开头（Excel 识别中文）
- 14 列：`ID, 时间, 用户, 模块, 动作, 业务类型, 业务ID, 描述, IP, URL, 方法, 耗时(ms), 状态, 失败原因`
- 超过 max 行时截断，响应头额外含 `X-Audit-Truncated: true`

## 四、Action 词表

后端 controller 层调用 `service.audit.log()` 时使用的固定动作枚举：

| action | 触发场景 |
|---|---|
| `create` | 创建实体（POST） |
| `update` | 修改实体（PUT） |
| `delete` | 删除实体（DELETE） |
| `batch_update` | 批量操作（如 tool/batch-publish） |
| `assign_permissions` | 角色分配权限（PUT /roles/:id/permissions） |
| `update_level` / `update_plan` | 会员等级 / 套餐定义更新 |
| `adjust_points` / `adjust_level` | 用户积分 / 等级调整 |
| `activate_plan` | 开通付费套餐 |

## 五、写入规范

详见 [Spec-A1 §7](../../superpowers/specs/2026-05-11-审计基础设施与权限测试设计文档.md#七高敏感接口回填17-个写操作)。

**关键约束：**
- **password / token / secret** 字段永不写入 audit_logs（service 层 _sanitizeParams 兜底脱敏 + controller 层调用方主动剔除）
- **bizId** 强制 string，超长（如 batch ids）取前 10 个用逗号拼接
- **失败也写**：try/catch 双路径，catch 内调 audit.log 后 throw 原异常

## 六、相关文档

- [Spec-A1 设计文档](../../superpowers/specs/2026-05-11-审计基础设施与权限测试设计文档.md)
- [Spec-A1 实施计划](../../superpowers/plans/2026-05-11-审计基础设施与权限测试实施计划.md)
- [audit_logs 表 schema](../../database/init.sql) line 628-657
