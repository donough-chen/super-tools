# 权限管理 (Permission) API 文档

> 自动生成于 2026/4/2 14:57:01

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/admin/permissions/tree` | ✅ | controller.admin.permission.tree |
| `GET` | `/api/admin/permissions/:id` | ✅ | controller.admin.permission.show |
| `POST` | `/api/admin/permissions` | ✅ | controller.admin.permission.create |
| `PUT` | `/api/admin/permissions/:id` | ✅ | controller.admin.permission.update |
| `DELETE` | `/api/admin/permissions/:id` | ✅ | controller.admin.permission.destroy |

---

## GET /api/admin/permissions/tree

**控制器：** `controller.admin.permission.tree`
**认证：** ✅ 需要 Bearer Token

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/permissions/tree`, {
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
const { data } = await axios.get(`${BASE_URL}/api/admin/permissions/tree`, {
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

## GET /api/admin/permissions/:id

**控制器：** `controller.admin.permission.show`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/permissions/{id}`, {
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
const { data } = await axios.get(`${BASE_URL}/api/admin/permissions/{id}`, {
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

## POST /api/admin/permissions

**控制器：** `controller.admin.permission.create`
**认证：** ✅ 需要 Bearer Token

### 请求体 (application/json)

```json
{
  "name": "权限名称",
  "code": "perm:code",
  "type": 1,
  "platform": "web",
  "sort": 100
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/permissions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
  "name": "权限名称",
  "code": "perm:code",
  "type": 1,
  "platform": "web",
  "sort": 100
}),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/admin/permissions`, payload, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": 1,
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
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

## PUT /api/admin/permissions/:id

**控制器：** `controller.admin.permission.update`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 请求体 (application/json)

```json
{
  "name": "权限名称",
  "code": "perm:code",
  "type": 1,
  "platform": "web",
  "sort": 100
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/permissions/{id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
  "name": "权限名称",
  "code": "perm:code",
  "type": 1,
  "platform": "web",
  "sort": 100
}),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/admin/permissions/{id}`, payload, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "更新成功",
  "data": null
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

## DELETE /api/admin/permissions/:id

**控制器：** `controller.admin.permission.destroy`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/permissions/{id}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.delete(`${BASE_URL}/api/admin/permissions/{id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
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
