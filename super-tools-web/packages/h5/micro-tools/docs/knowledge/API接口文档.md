# API 接口文档

> **适用范围**：`packages/h5/micro-tools/service.ts`  
> **最后更新**：2026-04-09

---

## 一、请求层设计

### 统一请求入口

所有接口在 `service.ts` 中统一定义，使用 shared 层的 `request` 工具：

```typescript
import { request } from '@/utils';
```

### 响应格式

```typescript
interface ApiResponse<T = any> {
  code: number;       // 0 = 成功，非 0 = 失败
  data: T;            // 业务数据
  message?: string;   // 错误信息（code 非 0 时）
}
```

### 响应解包

所有接口函数使用 `unwrap` 辅助函数自动解包响应：

```typescript
const unwrap = async <T>(promise: Promise<ApiResponse<T>>): Promise<T | null> => {
  const res = await promise;
  return res.code === 0 ? res.data : null;
};
```

- `code === 0` 时返回 `data`
- `code !== 0` 时返回 `null`
- 异常由调用方 catch 处理

---

## 二、接口清单

### 2.1 首页模块

#### 获取 Banner 列表

```
GET /api/banner/list
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

**返回数据：**

```typescript
interface BannerItem {
  id: string;         // Banner ID
  imageUrl: string;   // 图片 URL
  linkUrl: string;    // 点击跳转链接
  title: string;      // Banner 标题
}
```

**调用方式：**

```typescript
import { getBannerList } from '../service';
const banners = await getBannerList(); // BannerItem[] | null
```

---

#### 获取工具分类列表

```
GET /api/tool/categories
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

**返回数据：**

```typescript
interface ToolCategory {
  id: string;
  name: string;
  icon?: string;
  tools: ToolItem[];
}

interface ToolItem {
  id: string;
  name: string;
  icon: string;                    // 图标 URL
  fontClass?: string;              // iconfont class 名称
  iconTheme?: IconTheme;           // 图标颜色主题
  subtitle?: string;               // 副标题
  category: string;                // 所属分类 ID
  url: string;                     // 工具页面 URL
  contentType: 'native' | 'iframe' | 'external';
}

type IconTheme = 'default' | 'orange' | 'green' | 'blue' | 'purple'
  | 'red' | 'teal' | 'pink' | 'indigo' | 'amber' | 'cyan';
```

**调用方式：**

```typescript
import { getToolCategories } from '../service';
const categories = await getToolCategories(); // ToolCategory[] | null
```

---

#### 搜索工具

```
GET /api/tool/search
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | `string` | ✅ | 搜索关键词 |

**返回数据：** `ToolItem[]`

**调用方式：**

```typescript
import { searchTools } from '../service';
const results = await searchTools('JSON'); // ToolItem[] | null
```

---

### 2.2 收藏模块

#### 获取收藏列表

```
GET /api/favorite/list
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

**返回数据：** `ToolItem[]`

**调用方式：**

```typescript
import { getFavoriteTools } from '../service';
const favorites = await getFavoriteTools(); // ToolItem[] | null
```

---

#### 添加收藏

```
POST /api/favorite/add
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `toolId` | `string` | ✅ | 工具 ID |

**返回数据：** `boolean`

**调用方式：**

```typescript
import { addFavorite } from '../service';
const success = await addFavorite('tool-123'); // boolean | null
```

---

#### 取消收藏

```
POST /api/favorite/remove
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `toolId` | `string` | ✅ | 工具 ID |

**返回数据：** `boolean`

**调用方式：**

```typescript
import { removeFavorite } from '../service';
const success = await removeFavorite('tool-123'); // boolean | null
```

---

### 2.3 特色模块

#### 获取特色工具列表

```
GET /api/featured/list
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `'featured' \| 'vip'` | ✅ | 类型：特色功能 / 会员专属 |

**返回数据：** `ToolItem[]`

**调用方式：**

```typescript
import { getFeaturedTools } from '../service';
const tools = await getFeaturedTools('featured'); // ToolItem[] | null
const vipTools = await getFeaturedTools('vip');   // ToolItem[] | null
```

---

### 2.4 网站模块

#### 获取网站分类列表

```
GET /api/site/categories
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

**返回数据：**

```typescript
interface SiteCategory {
  id: string;
  name: string;
  icon?: string;
}
```

**调用方式：**

```typescript
import { getSiteCategories } from '../service';
const categories = await getSiteCategories(); // SiteCategory[] | null
```

---

#### 获取网站列表

```
GET /api/site/list
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `categoryId` | `string` | ✅ | 分类 ID |
| `sortType` | `string` | ❌ | 排序方式：`most_used` / `most_fav` / `newest` |

**返回数据：**

```typescript
interface SiteItem {
  id: string;
  name: string;
  icon: string;
  url: string;
  userCount: number;    // 使用人数
  favCount: number;     // 收藏人数
  createdAt: string;    // 创建时间
}
```

**调用方式：**

```typescript
import { getSiteList } from '../service';
const sites = await getSiteList({ categoryId: 'sc-1', sortType: 'most_used' });
```

---

### 2.5 认证模块

> 基于 SSO 多端认证体系，H5 端使用 `h5_client` 作为 OAuth 客户端标识，JWT AccessToken + RefreshToken 双 Token 机制。

#### 常量

```typescript
const H5_CLIENT_ID = 'h5_client';
const H5_CLIENT_SECRET = 'CHANGE_ME_H5_SECRET';
```

---

#### 账号密码登录

```
POST /api/auth/login
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | `string` | ✅ | 用户名 |
| `password` | `string` | ✅ | 密码 |
| `clientId` | `string` | ✅ | OAuth 客户端 ID（固定 `h5_client`） |
| `clientSecret` | `string` | ✅ | OAuth 客户端密钥 |

**返回数据：**

```typescript
interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;       // Token 有效期（秒）
  user: {
    id: number;
    uuid: string;
    username: string;
    nickname: string;
    avatar: string;
    email: string;
    userType: number;
  };
}
```

**调用方式：**

```typescript
import { authLogin } from '../service';
const data = await authLogin('admin', 'Admin@123456'); // LoginResponseData | null
```

---

#### 用户注册

```
POST /api/auth/register
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | `string` | ✅ | 用户名（至少 3 字符） |
| `email` | `string` | ✅ | 邮箱 |
| `password` | `string` | ✅ | 密码（至少 8 位，含大小写字母和数字） |
| `nickname` | `string` | ❌ | 昵称（可选） |

**返回数据：**

```typescript
interface RegisterResponseData {
  id: number;
  uuid: string;
  username: string;
  email: string;
  nickname: string;
}
```

**调用方式：**

```typescript
import { authRegister } from '../service';
const data = await authRegister({ username: 'test', email: 'test@example.com', password: 'Test@12345' });
```

---

#### Token 续期

```
POST /api/auth/refresh
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `refreshToken` | `string` | ✅ | 刷新令牌 |

**返回数据：**

```typescript
{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

**调用方式：**

```typescript
import { authRefresh } from '../service';
const data = await authRefresh('refresh-token-xxx'); // Token 数据 | null
```

---

#### 退出登录

```
POST /api/auth/logout
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数（需携带 Authorization 头） |

**返回数据：** `boolean`

**调用方式：**

```typescript
import { authLogout } from '../service';
await authLogout();
```

---

#### 获取用户资料

```
GET /api/users/profile
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数（需携带 Authorization 头） |

**返回数据：**

```typescript
interface UserProfileData {
  id: number;
  uuid: string;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  userType: number;       // 用户类型（0 普通 / 1 VIP）
  vipExpireAt?: string;
  phone?: string;
}
```

**调用方式：**

```typescript
import { getUserProfile } from '../service';
const profile = await getUserProfile(); // UserProfileData | null

// 兼容别名（等同于 getUserProfile）
import { getUserInfo } from '../service';
const info = await getUserInfo(); // UserProfileData | null
```

---

#### 获取会员信息

```
GET /api/member/info
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

**返回数据：**

```typescript
interface MemberInfo {
  plans: MemberPlan[];
}

interface MemberPlan {
  id: string;
  name: string;          // 套餐名称
  price: number;         // 价格
  duration: number;      // 时长（天）
  description: string;   // 套餐描述
}
```

**调用方式：**

```typescript
import { getMemberInfo } from '../service';
const info = await getMemberInfo(); // MemberInfo | null
```

---

## 三、Mock 数据

开发环境下，所有接口通过 `mock/index.ts` 提供 Mock 数据：

| 接口 | Mock 数据说明 |
|------|-------------|
| `GET /api/banner/list` | 3 条 Banner |
| `GET /api/tool/categories` | 2 个分类（热门 16 + 特色 16 = 32 个工具） |
| `GET /api/tool/search` | 按 keyword 过滤 |
| `GET /api/favorite/list` | 2 条收藏 |
| `POST /api/favorite/add` | 固定返回成功 |
| `POST /api/favorite/remove` | 固定返回成功 |
| `GET /api/featured/list` | 按 type 返回不同列表 |
| `GET /api/site/categories` | 5 个分类（开发/设计/产品/运营/AI） |
| `GET /api/site/list` | 2 条网站 |
| `POST /api/auth/login` | 校验账号密码（admin / Admin@123456），返回 Token + 用户信息 |
| `POST /api/auth/register` | 模拟注册成功，返回新用户信息 |
| `POST /api/auth/refresh` | 模拟 Token 续期，返回新 Token |
| `POST /api/auth/send-code` | 模拟发送验证码成功 |
| `POST /api/auth/logout` | 固定返回成功 |
| `GET /api/users/profile` | 测试用户资料 |
| `GET /api/member/info` | 2 个套餐（月度/年度） |

### 新增 Mock 数据

在 `mock/index.ts` 中按以下格式添加：

```typescript
export default {
  'GET /api/xxx': (req: any, res: any) => {
    res.json({
      code: 0,
      data: { /* 返回数据 */ },
    });
  },

  'POST /api/xxx': (req: any, res: any) => {
    const { param1 } = req.body;
    res.json({
      code: 0,
      data: true,
    });
  },
};
```

---

## 四、代理配置

开发环境下，接口通过代理转发到后端服务：

```typescript
// .umirc.dev.ts
proxy: {
  '/api': {
    target: 'https://test.your-api-server.com/',
    changeOrigin: true,
    logLevel: 'info',
    secure: false,
    filter: (_pathname: string, req: any) => req.xhr,
  },
},
```

> **注意**：Mock 数据优先级高于代理。如需使用真实接口，需临时移除或注释 `mock/index.ts` 中对应的 Mock。

---

## 五、新增接口 SOP

1. 在 `service.ts` 中添加接口函数（使用 `unwrap` 包裹）
2. 在 `mock/index.ts` 中添加对应 Mock 数据
3. 在对应 Store 中创建 action 调用接口
4. 更新本文档中的接口清单
