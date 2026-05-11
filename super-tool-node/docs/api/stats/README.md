# 数据统计接口文档

> 模块：`stats`  |  接口数：5  |  Spec-A2

## 一、概述

管理端大盘统计接口，5 个实时聚合接口覆盖常见指标。

**特性**：
- 全部实时 SQL（不预聚合），数据量 <100 万完全够用
- 时间范围默认最近 30 天；所有 SQL 索引命中
- CSV 导出复用 Spec-A1 `audit.exportCsv` 模板（UTF-8 BOM）

## 二、接口清单

| 方法 | 路径 | 权限码 | 说明 |
|---|---|---|---|
| GET | `/api/admin/stats/overview` | `stats:overview` | 大盘 8 字段 |
| GET | `/api/admin/stats/tool-usage` | `stats:tool-usage` | 工具使用 TOP N |
| GET | `/api/admin/stats/user-active` | `stats:user-active` | DAU/WAU/MAU + 新增用户趋势 |
| GET | `/api/admin/stats/trend` | `stats:trend` | 通用趋势（4 metric × 3 granularity） |
| GET | `/api/admin/stats/export` | `stats:export` | CSV 导出（3 类） |

## 三、overview — 大盘

**GET** `/api/admin/stats/overview`

**Response：**
```json
{
  "code": 200,
  "data": {
    "userCount": 1234,              // 全量用户
    "activeUserCount": 320,         // 近 7 日活跃用户（去重）
    "todayLoginCount": 152,         // 今日登录次数（含重复）
    "activeSessionCount": 48,       // 当前活跃会话
    "toolCount": 87,                // 在线工具数（status=1）
    "feedbackCount": 152,           // 全量反馈
    "pendingFeedbackCount": 12,     // 待处理反馈（status=0）
    "todayNewUserCount": 8          // 今日新增用户
  }
}
```

## 四、tool-usage — 工具使用 TOP N

**GET** `/api/admin/stats/tool-usage?startTime&endTime&limit=20`

**Query：**

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| startTime | ISO | 今日 -30 天 | 聚合开始 |
| endTime | ISO | 现在 | 聚合结束 |
| limit | int | 20，max 100 | TOP N |

**实现：** SQL 从 `api_logs` 提取 `/api/tools/:code/access` 请求；`GROUP BY code` + `COUNT(*)`；名称回填 tools 表。

**Response：**
```json
{
  "code": 200,
  "data": [
    { "toolCode": "image-compress", "toolName": "图片压缩", "count": 1245 },
    { "toolCode": "json-format",    "toolName": "JSON格式化", "count": 892 }
  ]
}
```

> 工具已删除 → `toolName` 返回 `(已删除/未知)`。

## 五、user-active — 用户活跃

**GET** `/api/admin/stats/user-active?startTime&endTime`

**Response：**
```json
{
  "code": 200,
  "data": {
    "dau": 45,                      // 过去 1 天活跃（去重登录）
    "wau": 187,                     // 过去 7 天
    "mau": 642,                     // 过去 30 天
    "newUserTrend": [
      { "date": "2026-05-01", "count": 12 },
      { "date": "2026-05-02", "count": 8 }
    ]
  }
}
```

> `newUserTrend` 缺失日期不返回 row（0 值不补）；前端用 ECharts `xAxis.type='time'` 自动处理空隙。

## 六、trend — 通用趋势（4 metric × 3 granularity）

**GET** `/api/admin/stats/trend?metric&granularity&startTime&endTime`

**Query：**

| 字段 | 必填 | 枚举 | 说明 |
|---|---|---|---|
| metric | ✅ | `user-register` / `user-login` / `feedback-submit` / `tool-access` | 指标 |
| granularity | 默认 day | `day` / `week` / `month` | 时间粒度 |
| startTime, endTime | 否 | ISO | 默认 30 天 |

**Response：**
```json
{
  "code": 200,
  "data": {
    "metric": "user-login",
    "granularity": "day",
    "points": [
      { "date": "2026-05-01", "count": 152 },
      { "date": "2026-05-02", "count": 189 }
    ]
  }
}
```

**bucket 格式：**
- `day` → `2026-05-11`
- `week` → `2026-W19`（ISO 周）
- `month` → `2026-05`

**错误：**
- 422 `invalid metric: <xxx>`
- 422 `invalid granularity: <xxx>`

## 七、export — CSV 导出

**GET** `/api/admin/stats/export?type=tool-usage|user-active|trend&...`

**Query：** `type` 必填；其他参数与对应接口一致。

**Response：** CSV 文件流（`Content-Type: text/csv; charset=utf-8` + UTF-8 BOM）。

### 7.1 tool-usage CSV

```
工具编码,工具名称,使用次数
image-compress,图片压缩,1245
json-format,JSON格式化,892
```

### 7.2 user-active CSV（多段格式）

```
指标,值
DAU,45
WAU,187
MAU,642

日期,新增数
2026-05-01,12
2026-05-02,8
```

> **多段**：总览段 + 空行分隔 + 趋势段。Excel 打开两段可分别选中复制。

### 7.3 trend CSV

```
指标,user-login
粒度,day

日期,数量
2026-05-01,152
2026-05-02,189
```

## 八、错误码

| HTTP | 触发 |
|---|---|
| 401 | 未登录 |
| 403 | 缺对应 stats:xxx 权限 |
| 422 | `metric/granularity/type required` 或枚举不合法 |

## 九、相关文档

- [Spec-A2 设计文档 §5](../../superpowers/specs/2026-05-11-反馈与数据统计设计文档.md#五service--stats-详细设计)
- [api_logs 表定义](../../../database/init.sql) line 663
