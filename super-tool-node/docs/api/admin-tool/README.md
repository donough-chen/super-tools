# 工具管理 API 文档（管理端）

> 路由前缀：`/api/admin/tool-categories`、`/api/admin/tools`
> 鉴权：**全部需 `auth` 中间件**
> 设计文档：[工具管理模块设计文档](../../superpowers/specs/2026-05-06-工具管理模块设计文档.md)
> 版本：v1.0（2026-05-06）

## 接口清单

### 分类接口（4 个）

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 1 | GET | `/api/admin/tool-categories` | 分类列表（分页） |
| 2 | POST | `/api/admin/tool-categories` | 创建分类 |
| 3 | PUT | `/api/admin/tool-categories/:id` | 更新分类 |
| 4 | DELETE | `/api/admin/tool-categories/:id` | 删除分类（旗下有工具则 400） |

### 工具接口（6 个）

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 5 | GET | `/api/admin/tools` | 工具列表（多条件筛选） |
| 6 | GET | `/api/admin/tools/:id` | 工具详情 |
| 7 | POST | `/api/admin/tools` | 创建工具 |
| 8 | PUT | `/api/admin/tools/:id` | 更新工具 |
| 9 | DELETE | `/api/admin/tools/:id` | 删除工具 |
| 10 | PUT | `/api/admin/tools/batch-publish` | **批量发布/下架** |

---

## 分类接口详细

### 1. GET /api/admin/tool-categories

#### Query 参数
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | |
| pageSize | int | 20 | 最大 100 |
| status | int | - | 0=禁用 / 1=启用 |
| keyword | string | - | 模糊匹配 name / code |

#### 响应
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1, "code": "DAILY", "name": "日常应用",
        "icon": null, "description": null,
        "sort": 0, "status": 1,
        "created_at": "2026-05-06T01:30:00.000Z",
        "updated_at": "2026-05-06T01:30:00.000Z",
        "toolCount": 16
      }
    ],
    "total": 11, "page": 1, "pageSize": 20, "totalPages": 1
  }
}
```

### 2. POST /api/admin/tool-categories

#### Body
| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| code | string | 是 | 2-30 字符，唯一 |
| name | string | 是 | 1-50 字符 |
| icon | string | 否 | ≤ 500 字符 |
| description | string | 否 | ≤ 500 字符 |
| sort | number | 否 | 默认 0 |
| status | enum | 否 | 0/1，默认 1 |

#### 错误
| HTTP | 场景 |
|------|------|
| 422 | 字段缺失/不合法 |
| 409 | code 重复 |

### 3. PUT /api/admin/tool-categories/:id

#### Body（均为可选）
同 POST。code 变更时会校验唯一，并**自动同步更新** `tools.category_code` 冗余字段。

#### 错误
| HTTP | 场景 |
|------|------|
| 404 | 分类不存在 |
| 409 | 新 code 与其他分类重复 |

### 4. DELETE /api/admin/tool-categories/:id

#### 错误
| HTTP | 场景 |
|------|------|
| 404 | 分类不存在 |
| 400 | 该分类下尚有 N 个工具，请先移除或删除后再操作 |

---

## 工具接口详细

### 5. GET /api/admin/tools

#### Query 参数
| 字段 | 类型 | 说明 |
|------|------|------|
| page / pageSize | int | 分页 |
| categoryCode | string | 按分类筛选 |
| status | 0/1 | 0=下架, 1=已发布 |
| isFeature | 0/1 | 特色功能 |
| requiredLevelCode | enum | free/silver/gold/diamond/black |
| requirePaid | 0/1 | 是否要求付费 |
| keyword | string | 模糊匹配 code/name/description/keyword |

#### 响应
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1, "code": "gold-price", "name": "今日黄金价格",
        "description": "实时黄金价格查询",
        "keyword": "黄金|价格|行情|投资",
        "categoryId": 1, "categoryCode": "DAILY",
        "icon": "/assets/imgs/...svg", "color": "#F39C12",
        "path": "/gold-price",
        "isFeature": 0, "requiredLevelCode": "free", "requirePaid": 0,
        "status": 1, "sort": 1,
        "created_at": "...", "updated_at": "...",
        "category": { "id": 1, "code": "DAILY", "name": "日常应用" }
      }
    ],
    "total": 233, "page": 1, "pageSize": 20, "totalPages": 12
  }
}
```

### 6. GET /api/admin/tools/:id

返回工具完整详情（含 `category` 关联）。

### 7. POST /api/admin/tools

#### Body
| 字段 | 类型 | 必填 | 默认 | 约束 |
|------|------|------|------|------|
| code | string | 是 | - | 2-60 字符，唯一 |
| name | string | 是 | - | 1-80 字符 |
| description | string | 否 | "" | ≤ 500 字符 |
| keyword | string | 否 | "" | ≤ 500 字符 |
| categoryId | number | 是 | - | 必须对应已有分类 |
| icon | string | 否 | "" | ≤ 500 字符 |
| color | string | 否 | "" | ≤ 20 字符 |
| path | string | 是 | - | 1-200 字符 |
| isFeature | 0/1 | 否 | 0 | |
| requiredLevelCode | enum | 否 | 'free' | free/silver/gold/diamond/black |
| requirePaid | 0/1 | 否 | 0 | |
| status | 0/1 | 否 | **0** | **默认未发布**，创建后需手动发布 |
| sort | number | 否 | 0 | |

`categoryCode` 由后端根据 `categoryId` 自动填充。

#### 错误
| HTTP | 场景 |
|------|------|
| 422 | 字段缺失/不合法 |
| 409 | code 重复 |
| 400 | categoryId 对应分类不存在 |

### 8. PUT /api/admin/tools/:id

Body 所有字段均可选。`categoryId` 变更时**自动同步**更新 `categoryCode` 冗余字段。

### 9. DELETE /api/admin/tools/:id

#### 错误
| HTTP | 场景 |
|------|------|
| 404 | 工具不存在 |

### 10. PUT /api/admin/tools/batch-publish — 批量发布/下架

#### Body
```json
{ "ids": [1, 2, 3], "status": 1 }
```

| 字段 | 类型 | 约束 |
|------|------|------|
| ids | number[] | 非空数组，最大 500 个 |
| status | 0/1 | 必填，0=批量下架 / 1=批量发布 |

#### 响应
```json
{
  "code": 200,
  "message": "批量处理成功",
  "data": { "affected": 3 }
}
```

`affected` 为 SQL 实际 UPDATE 的行数（部分 id 不存在或状态本已一致时会 < ids.length）。

#### 错误
| HTTP | 场景 |
|------|------|
| 422 | ids 为空数组 / status 非 0/1 / 超过 500 个 |

#### 路由顺序注意
⚠️ `PUT /api/admin/tools/batch-publish` 在路由表中**必须注册在** `PUT /api/admin/tools/:id` **之前**，否则会被 `:id` 参数捕获（`batch-publish` 会被当作 id）。

---

## 缓存治理

所有写操作（create/update/delete/batchPublish）完成后，均会调用 `clearCache('tool:*')` 清除：
- `tool:categories:all`（分类缓存，TTL 600s）
- `tool:home:aggregate`（首页聚合缓存，TTL 300s）

因此管理端修改后，H5 端下一次请求会立即看到最新数据。

---

## 权限说明

当前版本：**所有已登录用户**即可访问管理端接口（与现有 `/api/admin/member/*` 风格一致）。

后续若需引入细粒度权限控制（如仅管理员角色），可在路由层追加 admin-only 中间件。
