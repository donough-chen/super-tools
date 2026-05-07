# 工具模块 API 文档（H5 端）

> 路由前缀：`/api/tools`
> 设计文档：[工具管理模块设计文档](../../superpowers/specs/2026-05-06-工具管理模块设计文档.md)
> 版本：v1.0（2026-05-06）

## 接口清单

| # | 方法 | 路径 | 鉴权 | 说明 |
|---|------|------|------|------|
| 1 | GET | `/api/tools/home` | 否 | 首页聚合/分页双模式 |
| 2 | GET | `/api/tools/feature` | 否 | 特色功能 Tab |
| 3 | GET | `/api/tools/member` | 否 | 会员专属 Tab |
| 4 | GET | `/api/tools/:code/access` | **是** | 使用前权限校验 |

---

## 1. GET /api/tools/home — 首页聚合/分页

**鉴权：** 无

### Query 参数

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| categoryCode | string | 否 | - | 分类编码（DAILY/DOCUMENT/...）。**传入则切换到分页模式** |
| keyword | string | 否 | - | 关键字搜索（模糊匹配 name/description/keyword）。**传入则切换到分页模式** |
| page | int | 否 | 1 | 分页页码（仅分页模式有效） |
| pageSize | int | 否 | 20 | 每页条数，最大 100（仅分页模式有效） |

### 模式切换规则
- `categoryCode` 与 `keyword` **均未传**  → **聚合模式**：一次性返回全部分类 + 全部已发布工具
- **任一传入** → **分页模式**：返回全量分类 + 工具分页列表

### 响应（聚合模式）

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "mode": "aggregate",
    "categories": [
      {
        "id": 1,
        "code": "DAILY",
        "name": "日常应用",
        "icon": null,
        "description": null,
        "sort": 0,
        "tools": [
          {
            "id": 1,
            "code": "gold-price",
            "name": "今日黄金价格",
            "description": "实时黄金价格查询",
            "keyword": "黄金|价格|行情|投资",
            "categoryCode": "DAILY",
            "icon": "/assets/imgs/price_change_...svg",
            "color": "#F39C12",
            "path": "/gold-price",
            "isFeature": 0,
            "requiredLevelCode": "free",
            "requirePaid": 0,
            "sort": 1
          }
        ]
      }
    ]
  },
  "timestamp": 1778118660000
}
```

### 响应（分页模式）

```json
{
  "code": 200,
  "data": {
    "mode": "paginated",
    "categories": [
      { "id": 1, "code": "DAILY", "name": "日常应用", "icon": null, "description": null, "sort": 0 }
    ],
    "tools": {
      "list": [ /* Tool 对象数组 */ ],
      "total": 16,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
}
```

### 业务规则
- 仅返回 `status=1` 的工具、`status=1` 的分类
- 聚合模式按 `sort ASC, id ASC` 排序，不分页不截断
- 分页模式 `categoryCode` 不合法返回空列表（不报错）
- 聚合模式走 Redis 缓存（TTL 300s），分页模式不缓存

---

## 2. GET /api/tools/feature — 特色功能 Tab

**鉴权：** 无

### Query 参数
| 字段 | 类型 | 默认 |
|------|------|------|
| page | int | 1 |
| pageSize | int | 20 |

### 响应（标准分页）

```json
{
  "code": 200,
  "data": {
    "list": [ /* Tool 对象数组 */ ],
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

### 筛选条件
`WHERE is_feature = 1 AND status = 1` ORDER BY `sort ASC, id ASC`

---

## 3. GET /api/tools/member — 会员专属 Tab

**鉴权：** 无

### Query 参数
同 `/api/tools/feature`。

### 筛选条件
`WHERE status = 1 AND (required_level_code != 'free' OR require_paid = 1)` ORDER BY `sort ASC, id ASC`

### 与特色 Tab 的关系
**不互斥**：若一个工具既 `is_feature=1` 又 `required_level_code='silver'`，则在 `/feature` 和 `/member` **两个接口都会返回**。

---

## 4. GET /api/tools/:code/access — 使用前权限校验

**鉴权：** **需登录**（Authorization: Bearer \<token\>）

### Path 参数
| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | 工具编码（如 `gold-price`） |

### 响应（允许使用）

```json
{
  "code": 200,
  "data": {
    "allowed": true,
    "tool": {
      "code": "ai-chat",
      "name": "AI对话",
      "path": "/ai-chat"
    }
  }
}
```

### 响应（拒绝使用）

```json
{
  "code": 200,
  "data": {
    "allowed": false,
    "reason": "need_level",
    "required": {
      "levelCode": "silver",
      "levelName": "银牌会员",
      "requirePaid": false
    },
    "current": {
      "levelCode": "free",
      "isPaid": false
    }
  }
}
```

### `reason` 枚举

| 值 | 含义 |
|----|------|
| `need_level` | 用户当前等级不足 |
| `need_paid` | 工具要求付费会员，用户未付费 |
| `paid_expired` | 用户曾付费但已过期 |

### 错误响应

| HTTP | 业务场景 |
|------|----------|
| 401 | 未登录 |
| 404 | 工具不存在（`code` 查无此工具） |
| 400 | 工具已下架（`status=0`） |
| 404 | 会员记录不存在（用户未初始化 user_members） |

### 免费工具快速通道
若工具 `required_level_code='free'` 且 `require_paid=0`（所有用户可用），接口直接返回 `allowed:true`，**不查询 user_members 表**（性能优化）。

---

## 前端使用示例

```typescript
// 1. 加载首页
const res = await fetch('/api/tools/home');
const { categories } = res.data;
// 按 tab 展示 11 个分类，每个分类下展示 tools

// 2. 点击某工具卡片跳转前校验
async function jumpToTool(tool: Tool) {
  // 免费工具（从列表字段看出）直接跳转，跳过接口调用
  if (tool.requiredLevelCode === 'free' && tool.requirePaid === 0) {
    location.href = tool.path;
    return;
  }

  // 需校验的工具
  const accessRes = await fetch(`/api/tools/${tool.code}/access`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { allowed, reason, required } = accessRes.data;

  if (allowed) {
    location.href = accessRes.data.tool.path;
  } else if (reason === 'need_level') {
    showUpgradeDialog(required);   // 跳升级会员引导
  } else if (reason === 'need_paid' || reason === 'paid_expired') {
    showPurchaseDialog(required);  // 跳开通付费引导
  }
}
```
