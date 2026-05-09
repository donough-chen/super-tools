# 收藏模块 API 文档

> 路由前缀：`/api/favorites`
> 设计文档：[用户收藏工具模块设计文档](../../superpowers/specs/2026-05-08-用户收藏工具模块设计文档.md)
> 版本：v1.0（2026-05-08）

## 接口清单

| # | 方法 | 路径 | 鉴权 | 说明 |
|---|------|------|------|------|
| 1 | POST   | `/api/favorites` | ✅ | 收藏工具 |
| 2 | DELETE | `/api/favorites/:toolCode` | ✅ | 取消收藏 |
| 3 | GET    | `/api/favorites` | ✅ | 分页列表（支持搜索/分类筛选） |
| 4 | GET    | `/api/favorites/codes` | ✅ | 已收藏 code 轻量集合 |
| 5 | GET    | `/api/favorites/check/:toolCode` | ✅ | 单工具收藏态查询 |
| 6 | PUT    | `/api/favorites/reorder` | ✅ | 手动拖拽排序 |

> 全部接口需携带 `Authorization: Bearer <accessToken>`。未登录统一返回 401。

---

## 1. POST /api/favorites — 收藏工具

**Body（JSON）**：`toolId` / `toolCode` 二选一（至少提供一个）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| toolId | int | 否 | 工具主键 |
| toolCode | string | 否 | 工具编码（推荐） |

**响应 201**：

```json
{
  "code": 201,
  "message": "收藏成功",
  "data": {
    "id": 10,
    "toolId": 1,
    "toolCode": "gold-price",
    "sort": 10
  }
}
```

**错误场景**：

| HTTP | 业务 |
|------|------|
| 401 | 未登录 |
| 404 | 工具不存在或已下架（`status != 1`） |
| 409 | 已收藏过该工具（`FAVORITE_ALREADY_EXISTS`） |
| 422 | 未提供 `toolId/toolCode` 或参数非法 |

> 新收藏置于列表末尾：`sort = max(当前用户所有 sort) + 10`

---

## 2. DELETE /api/favorites/:toolCode — 取消收藏

**Path**：`toolCode` string，对应工具编码

**响应 200**：

```json
{ "code": 200, "message": "取消收藏成功", "data": null }
```

**错误场景**：

| HTTP | 业务 |
|------|------|
| 401 | 未登录 |
| 404 | 收藏记录不存在（`FAVORITE_NOT_FOUND`） |

---

## 3. GET /api/favorites — 收藏列表

**Query 参数**：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| pageSize | int | 20 | 每页条数（最大 100） |
| keyword | string | - | 工具 name/description/keyword 模糊匹配 |
| categoryCode | string | - | 按工具分类编码过滤（DAILY/DEV/IMAGE...） |

**排序规则**：`sort ASC, favoritedAt DESC, id DESC`

**响应 200**：

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 10,
        "toolId": 1,
        "toolCode": "gold-price",
        "sort": 10,
        "favoritedAt": "2026-05-08T03:00:00.000Z",
        "tool": {
          "id": 1,
          "code": "gold-price",
          "name": "今日黄金价格",
          "description": "实时黄金价格查询",
          "keyword": "黄金|价格|行情|投资",
          "categoryCode": "DAILY",
          "categoryName": "日常应用",
          "icon": "/assets/imgs/...svg",
          "color": "#F39C12",
          "path": "/gold-price",
          "isFeature": 0,
          "requiredLevelCode": "free",
          "requirePaid": 0,
          "status": 1
        }
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

---

## 4. GET /api/favorites/codes — 已收藏 code 集合

用于前端**工具列表页一次性标注收藏态**（心形高亮），避免在每个卡片上独立调用 `/check`。

**响应 200**：

```json
{
  "code": 200,
  "data": ["gold-price", "oil-price", "calculator"]
}
```

返回的顺序与 `GET /api/favorites` 一致（按 sort ASC）。

---

## 5. GET /api/favorites/check/:toolCode — 单工具收藏态

用于工具详情页即时查询当前工具是否被收藏。

**响应 200（已收藏）**：

```json
{
  "code": 200,
  "data": {
    "favorited": true,
    "sort": 10,
    "favoritedAt": "2026-05-08T03:00:00.000Z"
  }
}
```

**响应 200（未收藏）**：

```json
{ "code": 200, "data": { "favorited": false } }
```

---

## 6. PUT /api/favorites/reorder — 手动拖拽排序

**Body（JSON）**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderedToolCodes | string[] | 是 | **必须是当前用户全部收藏工具的 code**，且顺序为期望的新展示顺序 |

**约束**：
- 数组不能为空
- 不能含重复项
- 必须包含且仅包含当前用户**所有**已收藏工具（多一个、少一个、不存在于收藏列表中 → 400）

**响应 200**：

```json
{ "code": 200, "message": "排序已更新", "data": { "affected": 3 } }
```

**错误场景**：

| HTTP | 业务 |
|------|------|
| 401 | 未登录 |
| 422 | 数组为空或含重复项 |
| 400 | 数量/内容与当前收藏列表不一致（`FAVORITE_REORDER_MISMATCH`） |

**实现细节**：事务中按位序批量 UPDATE `sort = (i+1) * 10`，保证原子性。

---

## 前端使用示例

```typescript
import http from '@/utils/http';

// 1) 列表页进入时拉取收藏 code 集合，批量标注心形
const { data: favoritedCodes } = await http.get<string[]>('/api/favorites/codes');
const isFav = (code: string) => favoritedCodes.includes(code);

// 2) 点击心形切换收藏态
async function toggleFavorite(toolCode: string) {
  if (isFav(toolCode)) {
    await http.delete(`/api/favorites/${toolCode}`);
  } else {
    await http.post('/api/favorites', { toolCode });
  }
}

// 3) 个人收藏中心 - 搜索 + 分页
const { data } = await http.get('/api/favorites', {
  params: { keyword: '黄金', page: 1, pageSize: 20 },
});

// 4) 拖拽结束后同步顺序
async function onDragEnd(newOrder: Favorite[]) {
  await http.put('/api/favorites/reorder', {
    orderedToolCodes: newOrder.map(f => f.toolCode),
  });
}
```

---

## 错误码对照（1009xx 区间）

| 码 | 语义 |
|----|------|
| 100901 | 工具不存在或已下架 |
| 100902 | 已收藏过该工具 |
| 100903 | 收藏记录不存在 |
| 100904 | 排序参数与当前收藏列表不匹配 |
