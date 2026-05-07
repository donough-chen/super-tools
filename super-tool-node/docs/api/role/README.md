# 角色管理 (Role) API 文档

> 自动生成于 2026/4/2 14:57:01

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/admin/roles` | ✅ | controller.admin.role.index |
| `GET` | `/api/admin/roles/:id` | ✅ | controller.admin.role.show |
| `POST` | `/api/admin/roles` | ✅ | controller.admin.role.create |
| `PUT` | `/api/admin/roles/:id` | ✅ | controller.admin.role.update |
| `DELETE` | `/api/admin/roles/:id` | ✅ | controller.admin.role.destroy |
| `PUT` | `/api/admin/roles/:id/permissions` | ✅ | controller.admin.role.assignPermissions |

---

## GET /api/admin/roles

**控制器：** `controller.admin.role.index`
**认证：** ✅ 需要 Bearer Token

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/roles`, {
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
const { data } = await axios.get(`${BASE_URL}/api/admin/roles`, {
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

## GET /api/admin/roles/:id

**控制器：** `controller.admin.role.show`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/roles/{id}`, {
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
const { data } = await axios.get(`${BASE_URL}/api/admin/roles/{id}`, {
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

## POST /api/admin/roles

**控制器：** `controller.admin.role.create`
**认证：** ✅ 需要 Bearer Token

### 请求体 (application/json)

```json
{
  "name": "角色名称",
  "code": "role_code",
  "type": 2,
  "description": "角色描述",
  "status": 1
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/roles`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
  "name": "角色名称",
  "code": "role_code",
  "type": 2,
  "description": "角色描述",
  "status": 1
}),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/admin/roles`, payload, {
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

## PUT /api/admin/roles/:id

**控制器：** `controller.admin.role.update`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 请求体 (application/json)

```json
{
  "name": "角色名称",
  "code": "role_code",
  "type": 2,
  "description": "角色描述",
  "status": 1
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/roles/{id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
  "name": "角色名称",
  "code": "role_code",
  "type": 2,
  "description": "角色描述",
  "status": 1
}),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/admin/roles/{id}`, payload, {
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

## DELETE /api/admin/roles/:id

**控制器：** `controller.admin.role.destroy`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/roles/{id}`, {
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
const { data } = await axios.delete(`${BASE_URL}/api/admin/roles/{id}`, {
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

## PUT /api/admin/roles/:id/permissions

**控制器：** `controller.admin.role.assignPermissions`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number/string | id |

### 请求体 (application/json)

```json
{
  "permissionIds": [
    1,
    2,
    3
  ]
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/admin/roles/{id}/permissions`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
  "permissionIds": [
    1,
    2,
    3
  ]
}),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/admin/roles/{id}/permissions`, payload, {
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
