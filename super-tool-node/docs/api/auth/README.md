# 认证模块 (Auth) API 文档

> 更新于 2026/4/10 15:07:00
> 包含全平台认证系统新增接口：微信登录、手机号登录、账号绑定/解绑

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/login` | ❌ | 密码登录 |
| `POST` | `/api/auth/wechat-login` | ❌ | 微信登录（策略模式） |
| `POST` | `/api/auth/phone-login` | ❌ | 手机号验证码登录 |
| `GET` | `/api/auth/wechat-auth-url` | ❌ | 获取微信H5授权URL |
| `POST` | `/api/auth/register` | ❌ | 用户注册 |
| `POST` | `/api/auth/refresh` | ❌ | 刷新Token |
| `POST` | `/api/auth/send-code` | ❌ | 发送验证码 |
| `POST` | `/api/auth/logout` | ✅ | 登出 |
| `GET` | `/api/auth/sessions` | ✅ | 获取会话列表 |
| `DELETE` | `/api/auth/sessions/:id` | ✅ | 踢掉指定会话 |
| `POST` | `/api/auth/bind/phone` | ✅ | 绑定手机号 |
| `POST` | `/api/auth/bind/wechat` | ✅ | 绑定微信 |
| `POST` | `/api/auth/bind/email` | ✅ | 绑定邮箱 |
| `POST` | `/api/auth/unbind` | ✅ | 解绑账号 |
| `GET` | `/api/auth/bind-status` | ✅ | 获取绑定状态 |

---

## POST /api/auth/login

**控制器：** `controller.auth.login`
**认证：** ❌ 无需认证
**说明：** 密码登录，支持用户名/邮箱/手机号登录，含渐进式安全锁定机制

### 请求体 (application/json)

```json
{
  "username": "admin",
  "password": "Admin@123456",
  "clientId": "web",
  "clientSecret": "secret",
  "platform": "web",
  "captcha": "a1b2c3"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名/邮箱/手机号 |
| password | string | ✅ | 密码 |
| clientId | string | ✅ | OAuth 客户端ID |
| clientSecret | string | ✅ | OAuth 客户端密钥 |
| platform | string | ❌ | 平台标识（web/h5/miniprogram/ios/android） |
| captcha | string | ❌ | 图形验证码（连续失败5次后必填） |

### 前端调用示例

```javascript
// 使用 fetch
const response = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'Admin@123456',
    clientId: 'web',
    clientSecret: 'secret',
  }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/login`, {
  username: 'admin',
  password: 'Admin@123456',
  clientId: 'web',
  clientSecret: 'secret',
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "sessionId": "a1b2c3d4e5f6..."
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 100101 | 用户名或密码错误 |
| 401 | 100605 | 无效的客户端 |
| 401 | 100606 | 客户端密钥错误 |
| 422 | 422 | 请求参数校验失败 |
| 423 | 100602 | 账号已被临时锁定 |
| 423 | 100603 | 账号已被永久锁定 |
| 428 | 100601 | 需要输入验证码 |
| 500 | 500 | 服务器内部错误 |

### 安全机制

| 失败次数 | 触发行为 |
|----------|----------|
| 5次 | 需要图形验证码 |
| 8次 | 锁定15分钟 |
| 10次 | 锁定60分钟 |
| 15次 | 永久锁定（需管理员解锁） |

---

## POST /api/auth/wechat-login

**控制器：** `controller.auth.wechatLogin`
**认证：** ❌ 无需认证
**说明：** 微信登录统一入口，按 `platform` 参数自动分发到小程序/H5/APP 策略。首次登录自动创建账户（登录即注册）

### 请求体 (application/json)

```json
{
  "code": "0a1b2c3d4e5f",
  "platform": "miniprogram",
  "clientId": "miniprogram",
  "clientSecret": "secret",
  "userInfo": {
    "nickName": "微信用户",
    "avatarUrl": "https://..."
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | ✅ | 微信授权码（小程序wx.login / H5回调code / APP SDK code） |
| platform | string | ✅ | 平台: miniprogram / h5 / app / ios / android |
| clientId | string | ✅ | OAuth 客户端ID |
| clientSecret | string | ✅ | OAuth 客户端密钥 |
| userInfo | object | ❌ | 小程序端可选传用户信息（nickName, avatarUrl等） |

### 前端调用示例

```javascript
// 微信小程序
const loginRes = await wx.login();
const response = await fetch(`${BASE_URL}/api/auth/wechat-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: loginRes.code,
    platform: 'miniprogram',
    clientId: 'miniprogram',
    clientSecret: 'secret',
  }),
});
```

```javascript
// H5/Web 端（OAuth 回调后）
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const { data } = await axios.post(`${BASE_URL}/api/auth/wechat-login`, {
  code,
  platform: 'h5',
  clientId: 'h5',
  clientSecret: 'secret',
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "微信登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "sessionId": "a1b2c3d4e5f6...",
    "isNewUser": true
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 100401 | 微信授权码无效 |
| 401 | 100402 | 微信登录会话获取失败 |
| 401 | 100403 | 微信OAuth授权失败 |
| 401 | 100404 | 微信用户信息获取失败 |
| 400 | 100405 | 不支持的微信登录平台 |
| 401 | 100605 | 无效的客户端 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/phone-login

**控制器：** `controller.auth.phoneLogin`
**认证：** ❌ 无需认证
**说明：** 手机号验证码登录，首次登录自动创建账户（登录即注册）

### 请求体 (application/json)

```json
{
  "phone": "13800138000",
  "code": "123456",
  "clientId": "h5",
  "clientSecret": "secret",
  "platform": "h5"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | ✅ | 手机号 |
| code | string | ✅ | 短信验证码 |
| clientId | string | ✅ | OAuth 客户端ID |
| clientSecret | string | ✅ | OAuth 客户端密钥 |
| platform | string | ❌ | 平台标识 |

### 前端调用示例

```javascript
// 使用 fetch
const response = await fetch(`${BASE_URL}/api/auth/phone-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '13800138000',
    code: '123456',
    clientId: 'h5',
    clientSecret: 'secret',
  }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/phone-login`, {
  phone: '13800138000',
  code: '123456',
  clientId: 'h5',
  clientSecret: 'secret',
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "sessionId": "a1b2c3d4e5f6...",
    "isNewUser": false
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 100301 | 验证码错误或已过期 |
| 401 | 100605 | 无效的客户端 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/auth/wechat-auth-url

**控制器：** `controller.auth.getWechatAuthUrl`
**认证：** ❌ 无需认证
**说明：** 获取微信H5/公众号网页授权URL，用于H5端发起微信OAuth2授权

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| redirectUri | string | ✅ | 授权回调地址 |
| state | string | ❌ | 防CSRF状态参数 |

### 前端调用示例

```javascript
// 使用 fetch
const response = await fetch(
  `${BASE_URL}/api/auth/wechat-auth-url?redirectUri=${encodeURIComponent('https://example.com/callback')}&state=random123`,
);
const data = await response.json();
// data.data.url → 跳转到微信授权页
window.location.href = data.data.url;
```

```javascript
// 使用 axios
const { data } = await axios.get(`${BASE_URL}/api/auth/wechat-auth-url`, {
  params: { redirectUri: 'https://example.com/callback', state: 'random123' },
});
window.location.href = data.data.url;
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "url": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx123&redirect_uri=..."
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 400 | redirectUri 参数不能为空 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/register

**控制器：** `controller.auth.register`
**认证：** ❌ 无需认证

### 请求体 (application/json)

```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "Pass@123456",
  "nickname": "新用户",
  "clientId": "web",
  "platform": "web"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名（3-50字符） |
| email | string | ✅ | 邮箱 |
| password | string | ✅ | 密码（至少8字符） |
| clientId | string | ✅ | OAuth 客户端ID |
| nickname | string | ❌ | 昵称 |
| platform | string | ❌ | 注册平台 |

### 前端调用示例

```javascript
// 使用 fetch
const response = await fetch(`${BASE_URL}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'newuser',
    email: 'user@example.com',
    password: 'Pass@123456',
    nickname: '新用户',
    clientId: 'web',
  }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/register`, {
  username: 'newuser',
  email: 'user@example.com',
  password: 'Pass@123456',
  nickname: '新用户',
  clientId: 'web',
});
```

### 响应示例

```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "id": 1,
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100202 | 用户名已存在 |
| 400 | 100203 | 邮箱已被注册 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/refresh

**控制器：** `controller.auth.refresh`
**认证：** ❌ 无需认证

### 请求体 (application/json)

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 前端调用示例

```javascript
// 使用 fetch
const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: '<refresh_token>' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
  refreshToken: '<refresh_token>',
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "Token刷新成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "sessionId": "a1b2c3d4e5f6..."
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 100102 | Token 已过期 |
| 401 | 100103 | Token 无效 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/send-code

**控制器：** `controller.auth.sendCode`
**认证：** ❌ 无需认证
**说明：** 发送短信/邮箱验证码，含限流保护（60s间隔/日限10条/IP限20条/小时）

### 请求体 (application/json)

```json
{
  "target": "13800138000",
  "type": "login",
  "platform": "h5"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target | string | ✅ | 手机号或邮箱 |
| type | string | ✅ | 验证码类型: login / register / reset / bind |
| platform | string | ❌ | 平台标识 |

### 前端调用示例

```javascript
// 使用 fetch
const response = await fetch(`${BASE_URL}/api/auth/send-code`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ target: '13800138000', type: 'login' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/send-code`, {
  target: '13800138000',
  type: 'login',
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "验证码已发送",
    "expiresIn": 300
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 422 | 422 | 请求参数校验失败 |
| 429 | 100303 | 验证码发送过于频繁（60s内重复请求） |
| 429 | 100304 | 今日验证码发送次数已达上限 |
| 429 | 100305 | 当前IP发送验证码过于频繁 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/logout

**控制器：** `controller.auth.logout`
**认证：** ✅ 需要 Bearer Token

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/logout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "退出成功",
  "data": null
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/auth/sessions

**控制器：** `controller.auth.sessions`
**认证：** ✅ 需要 Bearer Token
**说明：** 获取当前用户所有活跃会话列表

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/sessions`, {
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
const { data } = await axios.get(`${BASE_URL}/api/auth/sessions`, {
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
      "sessionId": "a1b2c3d4e5f6...",
      "platform": "web",
      "ip": "192.168.1.1",
      "deviceName": "Chrome 120",
      "location": "广东深圳",
      "createdAt": "2026-04-10T10:00:00.000Z"
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

## DELETE /api/auth/sessions/:id

**控制器：** `controller.auth.kickSession`
**认证：** ✅ 需要 Bearer Token
**说明：** 踢掉指定会话（强制下线）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 会话ID (sessionId) |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/sessions/${sessionId}`, {
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
const { data } = await axios.delete(`${BASE_URL}/api/auth/sessions/${sessionId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "会话已终止",
  "data": null
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 404 | 会话不存在 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/bind/phone

**控制器：** `controller.auth.bindPhone`
**认证：** ✅ 需要 Bearer Token
**说明：** 为当前用户绑定手机号，需先发送验证码

### 请求体 (application/json)

```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | ✅ | 手机号 |
| code | string | ✅ | 短信验证码（通过 /api/auth/send-code 获取） |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/bind/phone`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ phone: '13800138000', code: '123456' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/bind/phone`,
  { phone: '13800138000', code: '123456' },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "手机号绑定成功"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100301 | 验证码错误或已过期 |
| 400 | 100501 | 该手机号已被其他用户绑定 |
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/bind/wechat

**控制器：** `controller.auth.bindWechat`
**认证：** ✅ 需要 Bearer Token
**说明：** 为当前用户绑定微信账号

### 请求体 (application/json)

```json
{
  "platform": "miniprogram",
  "code": "0a1b2c3d4e5f"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | ✅ | 平台: miniprogram / h5 / app |
| code | string | ✅ | 微信授权码 |

### 前端调用示例

```javascript
// 微信小程序
const loginRes = await wx.login();
const token = wx.getStorageSync('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/bind/wechat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ platform: 'miniprogram', code: loginRes.code }),
});
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/bind/wechat`,
  { platform: 'h5', code: wechatCode },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "微信绑定成功"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100501 | 该微信账号已被其他用户绑定 |
| 400 | 100502 | 您已绑定该微信账号 |
| 401 | 401 | 未认证或 Token 已失效 |
| 401 | 100401 | 微信授权码无效 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/bind/email

**控制器：** `controller.auth.bindEmail`
**认证：** ✅ 需要 Bearer Token
**说明：** 为当前用户绑定邮箱，需先发送验证码

### 请求体 (application/json)

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | ✅ | 邮箱地址 |
| code | string | ✅ | 邮箱验证码（通过 /api/auth/send-code 获取） |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/bind/email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/bind/email`,
  { email: 'user@example.com', code: '123456' },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "邮箱绑定成功"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100301 | 验证码错误或已过期 |
| 400 | 100501 | 该邮箱已被其他用户绑定 |
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## POST /api/auth/unbind

**控制器：** `controller.auth.unbind`
**认证：** ✅ 需要 Bearer Token
**说明：** 解绑手机号/微信/邮箱。安全规则：至少保留一种登录方式

### 请求体 (application/json)

```json
{
  "type": "wechat",
  "platform": "miniprogram"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | ✅ | 解绑类型: phone / wechat / email |
| platform | string | ❌ | 微信解绑时需指定平台: miniprogram / h5 / app |

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/unbind`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ type: 'phone' }),
});
const data = await response.json();
```

```javascript
// 使用 axios
const { data } = await axios.post(`${BASE_URL}/api/auth/unbind`,
  { type: 'wechat', platform: 'miniprogram' },
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "解绑成功"
  }
}
```

### 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 400 | 100503 | 不能解绑最后一种登录方式 |
| 401 | 401 | 未认证或 Token 已失效 |
| 404 | 100201 | 用户不存在 |
| 404 | 100504 | 未找到该绑定关系 |
| 422 | 422 | 请求参数校验失败 |
| 500 | 500 | 服务器内部错误 |

---

## GET /api/auth/bind-status

**控制器：** `controller.auth.bindStatus`
**认证：** ✅ 需要 Bearer Token
**说明：** 查询当前用户的所有账号绑定状态

### 前端调用示例

```javascript
// 使用 fetch
const token = localStorage.getItem('accessToken');
const response = await fetch(`${BASE_URL}/api/auth/bind-status`, {
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
const { data } = await axios.get(`${BASE_URL}/api/auth/bind-status`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "hasPassword": true,
    "phone": "138****8000",
    "email": "us***@example.com",
    "wechat": [
      {
        "platform": "wechat_miniprogram",
        "nickname": "微信用户",
        "avatar": "https://...",
        "boundAt": "2026-04-10T10:00:00.000Z"
      }
    ]
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
