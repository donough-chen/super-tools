# 支付宝沙箱接入指南（Phase 2）

> 适用范围：本项目 Phase 2 会员订阅引入支付宝沙箱（alipay-sdk@^4.14.0）作为真实支付通道，以替代 Phase 1 的 Mock 通道。
> 完成本文步骤后，可在 H5 收银台选择"支付宝（沙箱）"完成完整支付链路。

---

## 0. 前置条件

- Node.js ≥ 18（已确认 v20.x 可用）
- 已完成 Phase 2 后端代码部署（024 SQL + service/refund + alipay provider）
- 项目根目录已存在 `super-tool-node/.env.local.example` 模板

---

## 1. 注册沙箱账号 + 获取应用密钥

### 1.1 登录支付宝开放平台

访问 <https://open.alipay.com/develop/sandbox/account>，用淘宝/支付宝账号登录后会自动给你创建一个"沙箱应用"。

记下以下字段（沙箱后台首页直接可见）：

| 字段 | 用途 | 示例 |
|---|---|---|
| **APPID** | 应用 ID | `2021000000000000`（一定是 16 位数字） |
| **支付宝网关地址** | API 地址 | `https://openapi.alipaydev.com/gateway.do` |
| **沙箱买家账号** | 测试支付时使用 | `xxxxxx@sandbox.com` |
| **沙箱买家密码** | 测试支付时使用 | 沙箱后台直接显示明文 |

### 1.2 生成应用密钥对（RSA2）

下载支付宝官方密钥工具：<https://opendocs.alipay.com/common/02kipl>

1. 选择 **PKCS1（非Java）**、密钥长度 **2048**
2. 点"生成密钥"，会得到：
   - **应用私钥**（`merchant_private_key`）—— 你保管，绝不泄漏，配置到 `.env.local`
   - **应用公钥**（`app_public_key`）—— 上传到沙箱后台

### 1.3 上传应用公钥 + 获取支付宝公钥

1. 沙箱后台 → "RSA2(SHA256)密钥"右侧"设置/查看"
2. 粘贴步骤 1.2 的"应用公钥"内容（去掉 BEGIN/END 包裹后的纯 base64 内容）
3. 保存后页面会显示一个新的 **支付宝公钥**（`alipay_public_key`）—— 复制此公钥配置到 `.env.local`

> ⚠️ 注意：每次重新上传应用公钥，支付宝公钥会变。务必同步更新。

---

## 2. 配置 `.env.local`

复制 `.env.local.example` 为 `.env.local` 并填入真实值：

```bash
cd super-tool-node
cp .env.local.example .env.local
```

编辑 `.env.local`：

```bash
# ─── Alipay 沙箱 ───
ALIPAY_APP_ID=2021000000000000
ALIPAY_MERCHANT_PRIVATE_KEY=MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...（你的应用私钥纯 base64）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC...（沙箱后台显示的支付宝公钥）
ALIPAY_GATEWAY=https://openapi.alipaydev.com/gateway.do

# 异步通知 URL（详见 § 3 内网穿透）
ALIPAY_NOTIFY_URL=

# 同步跳转 URL（用户支付完跳回订单详情，本机即可）
ALIPAY_RETURN_URL=http://localhost:7001/api/payments/alipay/return

# H5 应用 baseUrl（alipayReturn 重定向到 ${H5_BASE_URL}/member/orders/:id）
H5_BASE_URL=http://localhost:8000
```

> 🔑 **私钥/公钥粘贴格式**：必须是去掉 `-----BEGIN/END ... KEY-----` 包裹后的**纯 base64 字符串**（一行，无换行）。SDK 会自动加上 PKCS1 包裹。
> 检查方法：`echo $ALIPAY_MERCHANT_PRIVATE_KEY | head -c 50` 应该是 `MIIEvQIBADANB...` 这种连续字符。

---

## 3. 异步通知（可选，但强烈推荐）

### 3.1 为什么需要

支付宝在用户付款成功后会调用 `POST ALIPAY_NOTIFY_URL`（公网可达），这是最可靠的通知渠道。

如果留空 `ALIPAY_NOTIFY_URL`：
- ✅ 用户支付完跳回 H5 → 收银台轮询 `getStatus` 5 秒后会主动 `alipay.trade.query` 兜底（双轨制）
- ❌ 缺点：纯依赖前端轮询，离线交易延迟 30 秒以上才能感知

### 3.2 内网穿透方案（推荐 cpolar）

本机开发时，alipay 网关无法直接调到 `localhost`，需要内网穿透：

#### 选项 A：cpolar（国内推荐）

```bash
# 安装：https://www.cpolar.com/
cpolar http 7001
```

输出会有形如 `https://abc123.r6.cpolar.cn → 127.0.0.1:7001` 的地址。把它写到 `.env.local`：

```bash
ALIPAY_NOTIFY_URL=https://abc123.r6.cpolar.cn/api/payments/alipay/notify
```

#### 选项 B：ngrok（国际，需翻墙）

```bash
ngrok http 7001
# 取 https://xxxx.ngrok.io
```

```bash
ALIPAY_NOTIFY_URL=https://xxxx.ngrok.io/api/payments/alipay/notify
```

### 3.3 验证通知能否触达

启动 dev 后随便发起一笔沙箱支付 + 完成支付。看 dev 日志：

```text
INFO  [alipayNotify] received raw body: out_trade_no=MP20260523... ...
INFO  [payment._applyPaymentSuccess] orderId=N userId=M
```

如果只看到收银台轮询日志而无 alipayNotify 日志 → 检查 cpolar/ngrok 是否在线。

---

## 4. 完整支付流程验证

### 4.1 启动后端 + 前端

```bash
# Terminal 1: 后端（加载 .env.local）
cd super-tool-node
npm run dev
# 关键日志：alipay 配置加载 / 路由注册（含 6 条新路由）

# Terminal 2: H5 前端
cd super-tools-web/packages/h5/micro-tools
npm run dev
```

### 4.2 H5 端发起支付

1. 浏览器访问 `http://localhost:8000/member`
2. 选一个套餐（非"永久"），点击订阅
3. 跳到收银台 `http://localhost:8000/member/cashier?orderId=N`
4. 选择 **"支付宝（沙箱）"**
5. 点击 **"🅰️ 去支付宝支付"** → 跳转沙箱网关

### 4.3 在沙箱网关完成支付

- 用步骤 1.1 的 **沙箱买家账号** 登录
- 看到金额显示与订单一致
- 点击"确认付款" → 显示"支付成功"
- 浏览器自动跳回 `http://localhost:7001/api/payments/alipay/return?out_trade_no=MP...&trade_no=...&total_amount=...`
- 后端 alipayReturn 重定向到 `http://localhost:8000/member/orders/N`

### 4.4 验证状态流转

观察以下数据：

| 数据 | 期望状态 |
|---|---|
| `member_payments.status` | `1`（已支付） + `provider_trade_no` 非空 |
| `member_orders.status` | `1`（已支付） + `paid_at` 非空 |
| `user_members.is_paid` | `1` + `paid_expire_at` 已更新 |
| 通知中心 | 收到 BUSINESS_PAYMENT_SUCCESS 站内信 |

如果异步通知到位 → DB 状态会在 1-3 秒内更新；
如果没到位 → 用户在订单详情页等 5 秒，前端轮询触发主动 query 后更新。

---

## 5. 退款流程验证

### 5.1 管理端发起退款

1. 浏览器登录管理端 `http://localhost:3000`（用 admin 账号）
2. 进入 "会员管理" → "订单管理"
3. 找到刚支付成功的订单（status=已支付）→ 点 "详情"
4. 抽屉右上角点 **"发起退款"** → 输入原因 → 确认

### 5.2 验证退款链路

观察日志：

```text
INFO  [refund.create] orderId=N reason=...
INFO  AlipaySdk.exec alipay.trade.refund {out_trade_no, refund_amount, ...}
INFO  AlipaySdk response code=10000 fund_change=Y trade_no=...
INFO  [refund._asyncAudit] success
INFO  [refund.create] notification BUSINESS_PAYMENT_REFUNDED sent
```

DB 状态：

| 表 | 期望 |
|---|---|
| `member_refunds` | 新增 1 行 status=1 + provider_refund_no 非空 |
| `member_payments.status` | `3`（已退款） |
| `member_orders.status` | `4`（已退款） |
| `user_members.is_paid` | `0` + `paid_expire_at=NOW`（立即失效） |

H5 端：

- 用户进入订单详情看到 "已退款" 状态 + 退款记录卡片
- 用户收到 BUSINESS_PAYMENT_REFUNDED 站内信通知

---

## 6. 常见问题排查

### Q1: 启动报错 "AlipayProvider 缺少必要配置"

**原因**：`.env.local` 没加载到 / 字段名拼错。

**排查**：
```bash
# 在 super-tool-node 下
node -e "require('dotenv').config({ path: '.env' }); require('dotenv').config({ path: '.env.local', override: true }); console.log({appId: process.env.ALIPAY_APP_ID, hasPriv: !!process.env.ALIPAY_MERCHANT_PRIVATE_KEY, hasPub: !!process.env.ALIPAY_PUBLIC_KEY})"
```

期望输出 `{ appId: '202100...', hasPriv: true, hasPub: true }`。

### Q2: 验签失败 `signature mismatch`

**原因**：粘贴时不小心带了 BEGIN/END 包裹 / 中间有换行。

**排查**：私钥/公钥都应该是**单行连续 base64**字符串。重新从密钥工具复制一遍。

### Q3: 调用 `alipay.trade.refund` 返回 `40004 ACQ.SYSTEM_ERROR`

**原因**：沙箱环境对快速重复退款有限制。等 30 秒再试。

### Q4: 用户跳回 `/api/payments/alipay/return` 但 H5 看到 status=0

**原因**：异步通知未触达 / 主动 query 还没到 5 秒。

**解决**：
- 等 5-10 秒后刷新订单详情
- 或检查 cpolar/ngrok 是否在线（`curl https://your-tunnel.cpolar.cn/api/payments/providers` 看是否能访问到本机）

### Q5: 私钥泄漏/上传到 git

**应急**：
1. 立即在沙箱后台"RSA2 密钥"页删除当前公钥 → 重新生成新密钥对
2. 删除 git 历史中的 `.env.local`：
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch super-tool-node/.env.local" \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```
3. 团队所有人重新拉代码

### Q6: 0.01 元最小金额限制

支付宝沙箱有最小金额限制（≥ 0.01 元）。如果套餐价格 < 0.01 元（极小概率，应不会出现），下单会失败。建议产品规则保证 plan.price ≥ 1.00。

---

## 7. 生产切换 checklist

从沙箱切到正式环境时：

| 项 | 沙箱 | 正式 |
|---|---|---|
| 网关 | `https://openapi.alipaydev.com/gateway.do` | `https://openapi.alipay.com/gateway.do` |
| AppId | 沙箱 16 位数字 | 在 <https://open.alipay.com/develop/manage> 创建正式应用获取 |
| 应用私钥/支付宝公钥 | 沙箱密钥工具 | 同密钥工具，**重新生成一对**用于正式（绝不可与沙箱混用） |
| `notifyUrl` | cpolar 临时 | 公网正式域名 + HTTPS（HTTP 会被 alipay 拒绝） |
| `returnUrl` | localhost | 公网正式域名 |
| 接口签名 | 已开通"手机网站支付" | 同上（沙箱默认全开通；正式需在控制台为应用开通） |
| 商户号验证 | 不需要 | 需企业实名认证 + 签约 |

---

## 8. 参考资料

- 官方文档：<https://opendocs.alipay.com/open/270/105898>（手机网站支付）
- 官方文档：<https://opendocs.alipay.com/open/00m6mh>（统一收单交易退款）
- alipay-sdk-nodejs：<https://github.com/alipay/alipay-sdk-nodejs-all>
- 本项目 spec：`docs/superpowers/specs/2026-05-23-会员订阅Phase2-支付宝退款升降级设计文档.md`

---

**最后更新**：2026-05-23（Phase 2 实施完成时）
