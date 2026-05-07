# 会员模块 API 文档

> 生成时间: 2026-04-15 | 模块: member
> 路由前缀: `/api/member` (C端) + `/api/admin/member` (管理端)

---

## 接口总览

### C 端接口（6 个）

| # | 方法 | 路径 | 说明 | 认证 |
|---|------|------|------|------|
| 1 | GET | `/api/member/levels` | 获取全部成长等级列表 | 无 |
| 2 | GET | `/api/member/plans` | 获取付费套餐列表 | 无 |
| 3 | GET | `/api/member/info` | 获取当前用户会员信息 | Bearer Token |
| 4 | GET | `/api/member/benefits` | 获取当前用户聚合权益 | Bearer Token |
| 5 | GET | `/api/member/points-logs` | 获取积分流水（分页） | Bearer Token |
| 6 | POST | `/api/member/daily-sign` | 每日签到领积分 | Bearer Token |

### 管理端接口（11 个）

| # | 方法 | 路径 | 说明 | 认证 |
|---|------|------|------|------|
| 1 | GET | `/api/admin/member/levels` | 获取等级定义列表 | Bearer Token |
| 2 | PUT | `/api/admin/member/levels/:id` | 更新等级定义 | Bearer Token |
| 3 | GET | `/api/admin/member/plans` | 获取套餐列表 | Bearer Token |
| 4 | PUT | `/api/admin/member/plans/:id` | 更新套餐 | Bearer Token |
| 5 | GET | `/api/admin/member/users` | 会员用户列表 | Bearer Token |
| 6 | GET | `/api/admin/member/users/:id` | 单个用户会员详情 | Bearer Token |
| 7 | POST | `/api/admin/member/users/:id/adjust-points` | 手动调整积分 | Bearer Token |
| 8 | PUT | `/api/admin/member/users/:id/level` | 手动调整等级 | Bearer Token |
| 9 | POST | `/api/admin/member/users/:id/activate-plan` | 手动开通付费会员 | Bearer Token |
| 10 | GET | `/api/admin/member/stats` | 会员统计数据 | Bearer Token |
| 11 | GET | `/api/admin/member/points-logs` | 全局积分流水查询 | Bearer Token |

---

## C 端接口详情

### GET /api/member/levels

获取全部成长等级列表。公开接口，无需认证，结果缓存 10 分钟。

**Response 200:**
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "普通会员",
      "code": "free",
      "level": 0,
      "color": "#999999",
      "upgradeGrowth": 0,
      "benefits": {
        "discount": 1.00,
        "daily_sign_points": 1,
        "max_devices": 3,
        "ad_free": false,
        "priority_support": false,
        "exclusive_content": false,
        "monthly_coupon": 0
      },
      "description": "注册即享，基础权益"
    }
  ]
}
```

---

### GET /api/member/plans

获取付费套餐列表。公开接口，无需认证，结果缓存 10 分钟。

**Response 200:**
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "月度会员",
      "code": "monthly",
      "durationDays": 30,
      "price": "6.80",
      "originalPrice": "9.90",
      "benefits": { "discount_extra": 0.05, "cloud_storage_gb": 10, "export_pdf": true },
      "giftPoints": 50,
      "giftGrowth": 100,
      "description": "按月订阅，灵活开通"
    }
  ]
}
```

---

### GET /api/member/info

获取当前登录用户的会员信息，包含成长等级、积分、下一等级进度、付费状态。

**Response 200:**
```json
{
  "code": 200,
  "data": {
    "level": { "id": 2, "name": "金牌会员", "code": "gold", "level": 2, "color": "#FFD700" },
    "growthValue": 2350,
    "totalPoints": 3200,
    "points": 1580,
    "totalConsume": 500.00,
    "nextLevel": {
      "name": "钻石会员", "code": "diamond",
      "upgradeGrowth": 5000, "progress": 0.47, "remaining": 2650
    },
    "paid": {
      "isPaid": true, "planName": "年度会员", "planCode": "yearly",
      "startAt": "2026-03-15T00:00:00Z", "expireAt": "2027-03-15T00:00:00Z", "remainingDays": 339
    }
  }
}
```

**Error:** `404` 会员记录不存在

---

### GET /api/member/benefits

获取当前用户的聚合权益（成长等级权益 + 付费会员权益合并）。

**Response 200:**
```json
{
  "code": 200,
  "data": {
    "levelCode": "gold",
    "isPaid": true,
    "paidPlanCode": "yearly",
    "benefits": {
      "discount": 0.87,
      "dailySignPoints": 3,
      "maxDevices": 20,
      "adFree": true,
      "prioritySupport": true,
      "exclusiveContent": true,
      "monthlyCoupon": 2,
      "cloudStorageGb": 100,
      "apiRateLimit": 10000,
      "exportPdf": true,
      "customTheme": true,
      "earlyAccess": true,
      "founderBadge": false
    }
  }
}
```

---

### GET /api/member/points-logs

获取当前用户的积分流水记录，支持分页和筛选。

**Query Parameters:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 20，最大 100 |
| type | number | 否 | 类型筛选：1获得/2消耗/3过期/4调整 |
| startDate | string | 否 | 开始日期 (YYYY-MM-DD) |
| endDate | string | 否 | 结束日期 (YYYY-MM-DD) |

**Response 200:**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1001, "type": 1, "source": "daily_login",
        "points": 3, "balance": 1583, "growthDelta": 1,
        "remark": "每日签到奖励", "createdAt": "2026-04-10T09:00:00Z"
      }
    ],
    "total": 156, "page": 1, "pageSize": 20, "totalPages": 8
  }
}
```

---

### POST /api/member/daily-sign

每日签到，获得积分和成长值。每天仅可签到一次，奖励积分随等级增长。

**Response 200:**
```json
{
  "code": 200,
  "message": "签到成功",
  "data": {
    "pointsEarned": 3,
    "growthEarned": 1,
    "currentPoints": 1583,
    "currentGrowth": 2351,
    "isLevelUp": false
  }
}
```

**Error:** `400` 今日已签到

---

## 管理端接口详情

### POST /api/admin/member/users/:id/adjust-points

管理员手动调整用户积分，必须填写备注用于审计。

**Request Body:**
```json
{
  "points": 500,
  "growthDelta": 0,
  "remark": "客诉补偿，工单#2345"
}
```

**Response 200:**
```json
{
  "code": 200,
  "message": "调整成功",
  "data": {
    "currentPoints": 2083,
    "currentGrowth": 2351,
    "isLevelUp": false
  }
}
```

---

### POST /api/admin/member/users/:id/activate-plan

管理员手动为用户开通付费会员。支持续期（在原到期时间基础上叠加）。

**Request Body:**
```json
{ "planCode": "yearly" }
```

**Response 200:**
```json
{
  "code": 200,
  "message": "开通成功",
  "data": {
    "planCode": "yearly",
    "planName": "年度会员",
    "startAt": "2026-04-15T00:00:00Z",
    "expireAt": "2027-04-15T00:00:00Z"
  }
}
```

---

### GET /api/admin/member/stats

获取会员体系统计数据。

**Response 200:**
```json
{
  "code": 200,
  "data": {
    "totalMembers": 15623,
    "paidMembers": 1234,
    "paidRate": 0.079,
    "levelDistribution": { "free": 10000, "silver": 3000, "gold": 1500, "diamond": 800, "black": 323 },
    "todayNewMembers": 45
  }
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 100701 | 会员记录不存在 |
| 100702 | 今日已签到 |
| 100703 | 积分余额不足 |
| 100704 | 等级不存在 |
| 100705 | 套餐不存在 |
| 100706 | 付费会员尚未过期 |

---

## 数据表

| 表名 | 说明 |
|------|------|
| `member_levels` | 成长等级定义表（5级） |
| `paid_plans` | 付费套餐定义表（4种） |
| `user_members` | 用户会员状态表（1:1 users） |
| `points_logs` | 积分流水表（1:N users） |
