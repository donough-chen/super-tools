# 仪表盘 (Dashboard) API 文档

> 自动生成于 2026/4/2 14:57:01

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/admin/dashboard` | ✅ | controller.admin.dashboard.index |

---

## GET /api/admin/dashboard

**控制器：** `controller.admin.dashboard.index`
**认证：** ✅ 需要 Bearer Token

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/dashboard`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 422 | 422 | 请求参数校验失败 |
| 404 | 404 | 资源不存在 |
| 500 | 500 | 服务器内部错误 |

---
