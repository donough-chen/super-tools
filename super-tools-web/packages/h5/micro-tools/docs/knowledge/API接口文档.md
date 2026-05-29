# API 接口文档

> **适用范围**：`packages/h5/micro-tools/service.ts`  
> **最后更新**：2026-05-29

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

> 后端路由前缀：`/api/favorites`（2026-05-08 起）。所有接口均需登录，Authorization 头由 `utils/authRequest` 拦截器统一注入。
> **响应码：GET/DELETE/PUT = 200，POST = 201。**

#### 2.2.1 收藏工具

```
POST /api/favorites
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `toolCode` | `string` | ✅ | 工具唯一编码（推荐） |

**成功响应：** `code = 201`

```typescript
interface AddFavoriteResult {
  id: number;
  toolId: number;
  toolCode: string;
  sort: number;
}
```

**幂等：** 若已收藏，后端返回 `code = 409`（前端 store 将其视作成功）。

```typescript
import { addFavoriteApi } from '../service/favorite';
const res = await addFavoriteApi('tool-json-format');
// res.code === 201 | 409 即视为成功
```

---

#### 2.2.2 取消收藏

```
DELETE /api/favorites/:toolCode
```

**成功响应：** `code = 200`

**幂等：** 若未收藏，后端返回 `code = 404`（前端 store 将其视作成功）。

```typescript
import { removeFavoriteApi } from '../service/favorite';
const res = await removeFavoriteApi('tool-json-format');
```

---

#### 2.2.3 分页收藏列表

```
GET /api/favorites
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | `number` | ❌ | 页码，默认 1 |
| `pageSize` | `number` | ❌ | 每页数量，默认 20，最大 100 |
| `keyword` | `string` | ❌ | 关键词过滤（匹配工具 name / description / keyword / code） |
| `categoryCode` | `string` | ❌ | 分类 code 过滤 |

**成功响应：** `code = 200`

```typescript
interface FavoriteListResult {
  list: Favorite[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Favorite {
  id: number;
  toolId: number;
  toolCode: string;
  sort: number;           // 用户自定义排序（ASC）
  favoritedAt: string;
  tool: Tool & { categoryName?: string };
}
```

```typescript
import { getFavoriteListApi } from '../service/favorite';
const res = await getFavoriteListApi({ page: 1, pageSize: 100 });
```

---

#### 2.2.4 已收藏 code 集合（轻量）

```
GET /api/favorites/codes
```

用于首页 / 工具列表页批量标注心形，不包含工具详情。

**成功响应：** `code = 200`

```typescript
interface FavoriteCodesResult {
  code: 200;
  data: string[];   // ['tool-a', 'tool-b', ...]
}
```

---

#### 2.2.5 单工具收藏态

```
GET /api/favorites/check/:toolCode
```

**成功响应：** `code = 200`

```typescript
interface FavoriteCheckResult {
  favorited: boolean;
  sort?: number;
  favoritedAt?: string;
}
```

---

#### 2.2.6 手动拖拽排序

```
PUT /api/favorites/reorder
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderedToolCodes` | `string[]` | ✅ | **必须包含当前用户全部已收藏工具 code**，顺序为期望展示顺序 |

**成功响应：** `code = 200`

```typescript
interface ReorderResult {
  affected: number;    // 受影响行数
}
```

**事务保证：** 后端以事务方式写入，若数组与实际收藏集合不一致则返回 400。

```typescript
import { reorderFavoritesApi } from '../service/favorite';
const res = await reorderFavoritesApi(['tool-a', 'tool-c', 'tool-b']);
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
const H5_CLIENT_SECRET = 'H5_SECRET';
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

---

## 六、积分成长体系接口

> 新增于 2026-05-29，对应 service 文件：`service/member.ts`（扩展）、`service/sign.ts`、`service/task.ts`、`service/pointsMall.ts`

### 会员模块（扩展）

| 方法 | 路径 | 函数名 | 说明 |
|------|------|--------|------|
| GET | `/api/member/levels` | `getMemberLevels` | 等级列表（公开） |
| GET | `/api/member/benefits` | `getMemberBenefits` | 当前用户权益对比 |
| GET | `/api/member/points-logs` | `getPointsLogs(params)` | 积分流水（分页+筛选） |
| POST | `/api/member/daily-sign` | `memberDailySign(idemKey)` | 备用签到（前端默认用 /api/sign） |

### 签到模块（`service/sign.ts`）

| 方法 | 路径 | 函数名 | 说明 |
|------|------|--------|------|
| GET | `/api/sign/status` | `getSignStatus` | 签到状态（含连签天数、本周日历） |
| POST | `/api/sign` | `doSign(idemKey)` | 签到（必传 Idempotency-Key） |

### 任务中心（`service/task.ts`）

| 方法 | 路径 | 函数名 | 说明 |
|------|------|--------|------|
| GET | `/api/tasks` | `getTasks` | 任务列表（5 种 type） |
| POST | `/api/tasks/:code/claim` | `claimTask(code, idemKey)` | 领取奖励（必传 Idempotency-Key） |

### 积分商城（`service/pointsMall.ts`）

| 方法 | 路径 | 函数名 | 说明 |
|------|------|--------|------|
| GET | `/api/points-mall/items` | `getMallItems(params)` | 商品列表（含适配器 `adaptMallItem`） |
| POST | `/api/points-mall/exchange` | `exchangeItem(itemId, idemKey)` | 兑换商品（必传 Idempotency-Key） |
| GET | `/api/points-mall/orders` | `getMallOrders(params)` | 兑换订单（含适配器 `adaptMallOrder`） |

### 写入接口约定

- 必传请求头 `Idempotency-Key: <UUID v4>`（使用 `utils/idempotency.ts` 的 `genIdemKey()` 生成）
- 限流：sign/claim 10次/分钟，exchange 5次/分钟
- 重放命中响应头 `x-idempotent-replayed: true`

### 数据模型

详见 `types/points.ts`，包含：`MemberLevelItem`、`SignStatus`、`SignResult`、`TaskItem`、`TaskClaimResult`、`PointsLog`、`MallItem`、`MallOrder`、`ExchangeResult` 等 20 个类型定义。
