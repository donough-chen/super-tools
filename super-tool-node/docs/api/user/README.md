# 用户模块 (User) API 文档

> 更新于 2026/4/10 15:07:00
> 包含全平台认证系统新增接口：扩展资料、设备管理

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/users/profile` | ✅ | 获取当前用户基础资料 |
| `GET` | `/api/users/profile/extra` | ✅ | 获取完整资料（基础+扩展） |
| `PUT` | `/api/users/profile` | ✅ | 更新个人资料（基础+扩展） |
| `PUT` | `/api/users/password` | ✅ | 修改密码 |
| `GET` | `/api/users/addresses` | ✅ | 获取地址列表 |
| `POST` | `/api/users/addresses` | ✅ | 添加地址 |
| `PUT` | `/api/users/addresses/:id` | ✅ | 更新地址 |
| `DELETE` | `/api/users/addresses/:id` | ✅ | 删除地址 |
| `POST` | `/api/users/devices` | ✅ | 注册/更新设备 |
| `GET` | `/api/users/devices` | ✅ | 获取设备列表 |
| `DELETE` | `/api/users/devices/:deviceId` | ✅ | 移除设备 |
| `PUT` | `/api/users/devices/:deviceId/push` | ✅ | 更新推送设置 |
| `GET` | `/api/users` | ✅ | 用户列表（管理端） |
| `GET` | `/api/users/:id` | ✅ | 用户详情（管理端） |
| `POST` | `/api/users` | ✅ | 创建用户（管理端） |
| `PUT` | `/api/users/:id` | ✅ | 更新用户（管理端） |
| `DELETE` | `/api/users/:id` | ✅ | 删除用户（管理端） |

---

## GET /api/users/profile

**控制器：** `controller.user.profile`
**认证：** ✅ 需要 Bearer Token
**说明：** 获取当前登录用户的基础资料信息

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/profile`, {
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
const { data } = await axios.get(`${BASE_URL}/api/users/profile`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "email": "admin@example.com",
    "phone": "13800138000",
    "nickname": "管理员",
    "avatar": null,
    "gender": 0,
    "birthday": null,
    "status": 1,
    "registerSource": "web",
    "roles": [
      { "id": 1, "name": "管理员", "code": "admin" }
    ]
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/users/profile/extra

**控制器：** `controller.user.profileExtra`
**认证：** ✅ 需要 Bearer Token
**说明：** 获取用户完整资料（基础信息 + 扩展 profile 信息），如不存在扩展信息会自动创建

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/profile/extra`, {
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
const { data } = await axios.get(`${BASE_URL}/api/users/profile/extra`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "email": "admin@example.com",
    "phone": "13800138000",
    "nickname": "管理员",
    "avatar": null,
    "gender": 0,
    "roles": [
      { "id": 1, "name": "管理员", "code": "admin" }
    ],
    "profile": {
      "bio": "这是一段个人简介",
      "signature": "个性签名",
      "regionCode": "440305",
      "language": "zh-CN",
      "timezone": "Asia/Shanghai",
      "referralCode": "A2B3C4D5",
      "invitedBy": null,
      "privacySettings": { "showPhone": false, "showEmail": true },
      "notificationSettings": { "push": true, "email": false, "sms": true }
    }
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 500 | 500 | 服务器内部错误 |

---

## PUT /api/users/profile

**控制器：** `controller.user.updateProfile`
**认证：** ✅ 需要 Bearer Token
**说明：** 更新个人资料，同时支持更新基础信息（users 表）和扩展信息（user_profiles 表）

### 请求体 (application/json)

```json
{
  "nickname": "新昵称",
  "avatar": "https://cdn.example.com/avatar.jpg",
  "gender": 1,
  "birthday": "1990-01-01",
  "bio": "全栈开发者",
  "signature": "代码改变世界",
  "regionCode": "440305",
  "language": "zh-CN",
  "timezone": "Asia/Shanghai",
  "privacySettings": { "showPhone": false },
  "notificationSettings": { "push": true, "email": false }
}
```

| 字段 | 类型 | 必填 | 归属表 | 说明 |
|------|------|------|--------|------|
| nickname | string | ❌ | users | 昵称 |
| avatar | string | ❌ | users | 头像URL |
| gender | number | ❌ | users | 性别: 0未知/1男/2女 |
| birthday | string | ❌ | users | 生日 (YYYY-MM-DD) |
| bio | string | ❌ | user_profiles | 个人简介（最长200字） |
| signature | string | ❌ | user_profiles | 个性签名（最长100字） |
| regionCode | string | ❌ | user_profiles | 地区行政编码 |
| language | string | ❌ | user_profiles | 语言偏好 |
| timezone | string | ❌ | user_profiles | 时区 |
| privacySettings | object | ❌ | user_profiles | 隐私设置 (JSON) |
| notificationSettings | object | ❌ | user_profiles | 通知偏好 (JSON) |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/profile`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ nickname: '新昵称', bio: '全栈开发者' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/users/profile`,
  { nickname: '新昵称', bio: '全栈开发者' },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "资料更新成功",
  "data": {
    "id": 1,
    "nickname": "新昵称",
    "profile": {
      "bio": "全栈开发者",
      "signature": "代码改变世界",
      "language": "zh-CN",
      "timezone": "Asia/Shanghai",
      "referralCode": "A2B3C4D5"
    }
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 500 | 500 | 服务器内部错误 |

---

## PUT /api/users/password

**控制器：** `controller.user.changePassword`
**认证：** ✅ 需要 Bearer Token
**说明：** 修改 / 设置当前用户的登录密码。

**两种模式：**
- **修改密码**（用户已设密码，`bind-status.hasPassword = true`）：必须传 `oldPassword`，后端会校验原密码
- **设置密码**（用户未设密码，例如手机号注册账号首次设置，`bind-status.hasPassword = false`）：`oldPassword` 可省略，后端会跳过原密码校验直接落库

前端可通过 `GET /api/auth/bind-status` 的 `hasPassword` 字段判断当前用户是哪种模式，并相应地决定是否展示"原密码"输入框。

### 请求体 (application/json)

```json
{
  "oldPassword": "OldPass@123",
  "newPassword": "NewPass@123"
}
```

或（首次设置密码场景）：

```json
{
  "newPassword": "NewPass@123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| oldPassword | string | 条件必填 | 原密码；当 `hasPassword=true` 时必传，`hasPassword=false` 时可省略 |
| newPassword | string | ✅ | 新密码（至少8字符） |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/password`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ oldPassword: 'OldPass@123', newPassword: 'NewPass@123' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/users/password`,
  { oldPassword: 'OldPass@123', newPassword: 'NewPass@123' },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "密码修改成功",
  "data": null
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100204 | 原密码错误 |
| 400 | - | 请输入原密码（已设密码用户未传 oldPassword） |
| 400 | - | 新密码不能与原密码相同 |
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/users/devices

**控制器：** `controller.user.registerDevice`
**认证：** ✅ 需要 Bearer Token
**说明：** 注册新设备或更新已有设备信息。如设备ID已存在则更新

### 请求体 (application/json)

```json
{
  "deviceId": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "deviceType": "ios",
  "deviceName": "iPhone 15 Pro",
  "osVersion": "iOS 18.0",
  "appVersion": "2.1.0",
  "pushToken": "fcm-token-xxxx..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | string | ✅ | 设备唯一标识 |
| deviceType | string | ✅ | 设备类型: ios / android / web / h5 / miniprogram |
| deviceName | string | ❌ | 设备名称 |
| osVersion | string | ❌ | 操作系统版本 |
| appVersion | string | ❌ | 应用版本 |
| pushToken | string | ❌ | 推送Token (FCM/APNs) |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/devices`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    deviceId: 'A1B2C3D4-E5F6-7890',
    deviceType: 'ios',
    deviceName: 'iPhone 15 Pro',
  }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/users/devices`,
  { deviceId: 'A1B2C3D4-E5F6-7890', deviceType: 'ios', deviceName: 'iPhone 15 Pro' },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "userId": 1,
    "deviceId": "A1B2C3D4-E5F6-7890",
    "deviceName": "iPhone 15 Pro",
    "deviceType": "ios",
    "osVersion": "iOS 18.0",
    "appVersion": "2.1.0",
    "pushToken": "fcm-token-xxxx...",
    "pushEnabled": 1,
    "lastActiveAt": "2026-04-10T15:00:00.000Z",
    "status": 1
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/users/devices

**控制器：** `controller.user.listDevices`
**认证：** ✅ 需要 Bearer Token
**说明：** 获取当前用户所有活跃设备列表，按最后活跃时间倒序

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/devices`, {
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
const { data } = await axios.get(`${BASE_URL}/api/users/devices`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 1,
      "deviceId": "A1B2C3D4-E5F6-7890",
      "deviceName": "iPhone 15 Pro",
      "deviceType": "ios",
      "osVersion": "iOS 18.0",
      "appVersion": "2.1.0",
      "pushEnabled": 1,
      "lastActiveAt": "2026-04-10T15:00:00.000Z"
    },
    {
      "id": 2,
      "deviceId": "web-browser-chrome-120",
      "deviceName": "Chrome 120",
      "deviceType": "web",
      "pushEnabled": 0,
      "lastActiveAt": "2026-04-09T10:00:00.000Z"
    }
  ]
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 500 | 500 | 服务器内部错误 |

---

## DELETE /api/users/devices/:deviceId

**控制器：** `controller.user.removeDevice`
**认证：** ✅ 需要 Bearer Token
**说明：** 移除指定设备（软删除，将状态设为0）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| deviceId | string | 设备唯一标识 |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/devices/${deviceId}`, {
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
const { data } = await axios.delete(`${BASE_URL}/api/users/devices/${deviceId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "设备已移除"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 404 | 设备不存在 |
| 500 | 500 | 服务器内部错误 |

---

## PUT /api/users/devices/:deviceId/push

**控制器：** `controller.user.updatePushSettings`
**认证：** ✅ 需要 Bearer Token
**说明：** 更新指定设备的推送开关

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| deviceId | string | 设备唯一标识 |

### 请求体 (application/json)

```json
{
  "pushEnabled": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pushEnabled | boolean | ✅ | 是否开启推送 |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/devices/${deviceId}/push`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ pushEnabled: true }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/users/devices/${deviceId}/push`,
  { pushEnabled: true },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "deviceId": "A1B2C3D4-E5F6-7890",
    "deviceType": "ios",
    "pushEnabled": 1,
    "lastActiveAt": "2026-04-10T15:00:00.000Z"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 404 | 设备不存在 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/users/addresses

**控制器：** `controller.user.listAddresses`
**认证：** ✅ 需要 Bearer Token

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/addresses`, {
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
const { data } = await axios.get(`${BASE_URL}/api/users/addresses`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 1,
      "receiver": "张三",
      "phone": "13800138000",
      "province": "广东省",
      "city": "深圳市",
      "district": "南山区",
      "address": "科技园路1号",
      "isDefault": 1
    }
  ]
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/users/addresses

**控制器：** `controller.user.addAddress`
**认证：** ✅ 需要 Bearer Token

### 请求体 (application/json)

```json
{
  "receiver": "张三",
  "phone": "13800138000",
  "province": "广东省",
  "city": "深圳市",
  "district": "南山区",
  "address": "科技园路1号"
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/addresses`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    receiver: '张三', phone: '13800138000',
    province: '广东省', city: '深圳市', district: '南山区', address: '科技园路1号',
  }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/users/addresses`, payload, {
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
    "receiver": "张三",
    "phone": "13800138000",
    "province": "广东省",
    "city": "深圳市",
    "district": "南山区",
    "address": "科技园路1号"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## PUT /api/users/addresses/:id

**控制器：** `controller.user.updateAddress`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 地址ID |

### 请求体 (application/json)

```json
{
  "receiver": "张三",
  "phone": "13800138000",
  "province": "广东省",
  "city": "深圳市",
  "district": "南山区",
  "address": "科技园路1号"
}
```

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/addresses/${id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/users/addresses/${id}`, payload, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 1,
    "receiver": "张三",
    "phone": "13800138000"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 404 | 地址不存在 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## DELETE /api/users/addresses/:id

**控制器：** `controller.user.deleteAddress`
**认证：** ✅ 需要 Bearer Token

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 地址ID |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users/addresses/${id}`, {
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
const { data } = await axios.delete(`${BASE_URL}/api/users/addresses/${id}`, {
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
| 404 | 404 | 地址不存在 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/users

**控制器：** `controller.user.index`
**认证：** ✅ 需要 Bearer Token（管理端）

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | ❌ | 页码（默认1） |
| pageSize | number | ❌ | 每页条数（默认20） |
| keyword | string | ❌ | 搜索关键词（用户名/邮箱/昵称/手机号） |
| status | number | ❌ | 状态筛选: 0=禁用, 1=正常 |
| registerSource | string | ❌ | 注册来源筛选（web/h5/miniprogram/ios/android/admin） |
| startDate | string | ❌ | 注册起始日期 |
| endDate | string | ❌ | 注册结束日期 |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/users?page=1&pageSize=20&keyword=test`, {
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
const { data } = await axios.get(`${BASE_URL}/api/users`, {
  params: { page: 1, pageSize: 20, keyword: 'test' },
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      { "id": 1, "username": "admin", "email": "admin@example.com", "status": 1 }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/users/:id

**控制器：** `controller.user.show`
**认证：** ✅ 需要 Bearer Token（管理端）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 用户ID |

### 前端调用示例

```javascript
// 使用 axios
const { data } = await axios.get(`${BASE_URL}/api/users/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "uuid": "550e8400-...",
    "username": "admin",
    "email": "admin@example.com",
    "roles": [{ "id": 1, "name": "管理员", "code": "admin" }]
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/users

**控制器：** `controller.user.create`
**认证：** ✅ 需要 Bearer Token（管理端）

### 请求体 (application/json)

```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "Pass@123456",
  "phone": "13800138000",
  "nickname": "用户昵称"
}
```

### 前端调用示例

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/users`, payload, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": 2,
    "uuid": "550e8400-...",
    "username": "newuser"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100202 | 用户名已存在 |
| 400 | 100203 | 邮箱已被注册 |
| 400 | 100205 | 手机号已被注册 |
| 401 | 401 | 未认证或 Token 已失效 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## PUT /api/users/:id

**控制器：** `controller.user.update`
**认证：** ✅ 需要 Bearer Token（管理端）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 用户ID |

### 请求体 (application/json)

```json
{
  "nickname": "新昵称",
  "status": 1
}
```

### 前端调用示例

```javascript
// 使用 axios
const { data } = await axios.put(`${BASE_URL}/api/users/${id}`, payload, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 1,
    "nickname": "新昵称",
    "status": 1
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 500 | 500 | 服务器内部错误 |

---

## DELETE /api/users/:id

**控制器：** `controller.user.destroy`
**认证：** ✅ 需要 Bearer Token（管理端）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 用户ID |

### 前端调用示例

```javascript
// 使用 axios
const { data } = await axios.delete(`${BASE_URL}/api/users/${id}`, {
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
| 404 | 100201 | 用户不存在 |
| 500 | 500 | 服务器内部错误 |

---
