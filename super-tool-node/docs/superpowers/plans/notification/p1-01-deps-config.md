# P1-01：后端依赖、配置与 plugin 启用（Task 1）

> 子文件 1/12，对应 [P1 总览](./2026-05-16-notification-phase-1-00-overview.md) Task 1。

**Goal:** 引入 BullMQ + egg-socket.io 依赖，启用 plugin，添加 notification + io 配置块。

**Files:**
- Modify: `super-tool-node/package.json`
- Modify: `super-tool-node/config/plugin.ts`
- Modify: `super-tool-node/config/config.default.ts`

**前置依赖**：无（首个 Task）

---

## Step 1: 安装新依赖

- [ ] 在 super-tool-node 目录下安装

Run:

```bash
cd super-tool-node
npm install --save bullmq@^5.0.0 egg-socket.io@^4.7.0
npm install --save-dev @types/socket.io@^3.0.0
```

Expected: `package.json` 中 dependencies 段新增 `bullmq` 和 `egg-socket.io`，devDependencies 新增 `@types/socket.io`；`package-lock.json` 同步更新。

> **关于版本**：`bullmq@^5` 要求 Node 18+（你项目 engines 已指定 >=18.0.0，OK）；`egg-socket.io@^4.7` 是 Egg.js 3 的兼容版本。

---

## Step 2: 启用 socketIo plugin

- [ ] 修改 `super-tool-node/config/plugin.ts`

完整替换为：

```ts
import { EggPlugin } from 'egg';

const plugin: EggPlugin = {
  sequelize: {
    enable: true,
    package: 'egg-sequelize',
  },
  redis: {
    enable: true,
    package: 'egg-redis',
  },
  jwt: {
    enable: true,
    package: 'egg-jwt',
  },
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  validate: {
    enable: true,
    package: 'egg-validate',
  },
  // 【新增】Socket.IO 实时通信
  io: {
    enable: true,
    package: 'egg-socket.io',
  },
};

// 本地开发环境若无数据库/Redis 可临时关闭:
// plugin.sequelize!.enable = false;
// plugin.redis!.enable = false;

export default plugin;
```

---

## Step 3: 添加 notification + io 配置块

- [ ] 修改 `super-tool-node/config/config.default.ts`，在 `appConfig` 配置后追加：

```ts
// ==================== 通知系统 ====================
config.notification = {
  enabled: true,                              // kill switch（紧急关闭）
  globalQuietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
    timezone: 'Asia/Shanghai',
    affectedPriorities: [3],                  // 仅 P3 受全局静默约束
  },
  message: {
    retentionDays: 90,
    expireDefaultDays: 180,
  },
  sendLog: {
    retentionDays: 90,
  },
  queue: {
    sendConcurrency: 50,
    broadcastConcurrency: 5,
    exportConcurrency: 2,
    defaultAttempts: 3,
    p0Attempts: 5,
  },
  socket: {
    namespace: '/notification',
    pingInterval: 25000,
    pingTimeout: 60000,
  },
  rateLimit: {
    cacheRulesSeconds: 300,
  },
};

// ==================== Socket.IO ====================
config.io = {
  init: { wsEngine: 'ws' },
  namespace: {
    '/notification': {
      connectionMiddleware: ['notificationAuth'],
      packetMiddleware: [],
    },
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    db: 0,
  },
};
```

- [ ] 同时在文件底部追加类型声明（让 TypeScript 识别 `config.notification`）：

```ts
declare module 'egg' {
  interface EggAppConfig {
    notification: {
      enabled: boolean;
      globalQuietHours: {
        enabled: boolean;
        start: string;
        end: string;
        timezone: string;
        affectedPriorities: number[];
      };
      message: { retentionDays: number; expireDefaultDays: number };
      sendLog: { retentionDays: number };
      queue: {
        sendConcurrency: number;
        broadcastConcurrency: number;
        exportConcurrency: number;
        defaultAttempts: number;
        p0Attempts: number;
      };
      socket: { namespace: string; pingInterval: number; pingTimeout: number };
      rateLimit: { cacheRulesSeconds: number };
    };
  }
}
```

> **注意**：如果 `config.default.ts` 文件顶部已有 `declare module 'egg' { ... }`，应将新字段合并到现有声明中，而不是重复声明。

---

## Step 4: 启动验证

- [ ] 启动 dev 服务确认无错误

Run:

```bash
cd super-tool-node
npm run dev
```

Expected:
- 控制台无 plugin 加载错误
- socket.io 服务启动，监听 `/notification` 命名空间
- 启动日志中包含类似 `egg-socket.io plugin started` 字样

**故障排查**：
- 若出现 `Cannot find module 'egg-socket.io'`：回到 Step 1 确认 npm install 成功
- 若出现 `notificationAuth middleware not found`：先忽略，该中间件将在 Task 12 创建；当前可临时移除 `connectionMiddleware: ['notificationAuth']` 这行让服务能起来，等 Task 12 再加回
- 若 Redis 连接失败：检查 `REDIS_HOST` / `REDIS_PORT` 环境变量

---

## Step 5: Commit

- [ ] 提交所有修改

```bash
git add super-tool-node/package.json super-tool-node/package-lock.json super-tool-node/config/plugin.ts super-tool-node/config/config.default.ts
git commit -m "feat(notification): add bullmq and egg-socket.io dependencies, register plugins and config

- Add bullmq@^5.0.0 for async queue (reuses existing ioredis)
- Add egg-socket.io@^4.7.0 for realtime push (room-based by user)
- Register io plugin with /notification namespace
- Add config.notification block (kill switch, queue concurrency, quiet hours, etc.)
- Add config.io block (socket.io configuration)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §3.2, §3.4)"
```

---

## Verification Checklist

- [ ] `package.json` 含 `bullmq` 和 `egg-socket.io` 依赖
- [ ] `config/plugin.ts` 中 `io` plugin 已启用
- [ ] `config/config.default.ts` 含 `config.notification` 和 `config.io` 配置块
- [ ] 类型声明扩展 `EggAppConfig` 接口
- [ ] `npm run dev` 启动成功，无 plugin 错误
- [ ] git commit 已提交

完成本 Task 后请进入 [`p1-02-errcodes.md`](./p1-02-errcodes.md)。
