// Mock 数据接口
// 提供天气、工具列表、用户认证、公告等接口的 Mock 数据

// ==================== Mock 数据存储（模拟数据库） ====================

/** Mock 用户数据（模拟 users.json） */
const mockUsers: Record<string, any> = {
  admin: {
    id: 'user_001',
    username: 'admin',
    nickname: '管理员',
    email: 'admin@example.com',
    passwordHash: 'hashed_admin123', // 实际应使用 bcrypt
    avatar: '',
    role: 'admin',
    settings: {
      notificationEnabled: true,
      theme: 'light',
      language: 'zh-CN',
    },
    readAnnouncements: [], // 已读公告 ID 列表
    createdAt: '2024-01-01T00:00:00.000Z',
  },
};

/** Mock 公告数据（模拟 announcements.json） */
const mockAnnouncements = [
  {
    id: 'ann_001',
    title: '🎉 Super Tools v2.0 正式发布！',
    content: `## 🎉 Super Tools v2.0 正式发布！

我们很高兴地宣布 **Super Tools v2.0** 正式上线！本次更新带来了大量新功能和体验优化。

### ✨ 新增功能

- **全新 Tab 标签页系统** — 支持多工具同时打开，像浏览器一样使用
- **深色模式** — 保护您的眼睛，支持自动跟随系统
- **主题色定制** — 4 种主题色可选，打造专属风格
- **全局搜索优化** — 搜索速度提升 3 倍，支持拼音搜索

### 🔧 优化改进

- 页面加载速度提升 40%
- 修复了若干已知问题
- 优化了移动端适配

### 📅 后续计划

- 用户账号系统（即将上线）
- 工具收藏功能
- 使用历史记录

感谢您一直以来的支持！如有问题请联系我们。`,
    publishTime: '2024-03-20T10:00:00.000Z',
    targetAudience: 'all', // all | registered
    isActive: true,
  },
  {
    id: 'ann_002',
    title: '📢 新增 50+ 实用工具',
    content: `## 📢 新增 50+ 实用工具

本次更新新增了大量实用工具，覆盖更多使用场景。

### 🆕 新增工具分类

**图片处理**
- 图片压缩（支持批量）
- 图片格式转换（WebP/AVIF）
- 图片水印添加

**开发工具**
- JWT 解析器
- Cron 表达式生成器
- 正则表达式测试器

**文本工具**
- Markdown 预览器
- 文本差异对比
- 字数统计器

欢迎体验并反馈！`,
    publishTime: '2024-03-15T09:00:00.000Z',
    targetAudience: 'all',
    isActive: true,
  },
];

// 简单 token 存储（模拟 session）
const activeSessions: Record<string, string> = {}; // token -> userId

// 生成简单 token
const generateToken = (userId: string) => {
  const token = `mock-token-${userId}-${Date.now()}`;
  activeSessions[token] = userId;
  return token;
};

// 简单密码哈希（模拟，实际应用需使用 bcrypt）
const hashPassword = (password: string) => `hashed_${password}`;

export default {
  // ==================== 天气接口 ====================
  'GET /api/weather': {
    code: 200,
    message: 'success',
    data: {
      city: '北京',
      temp: '18°C',
      weather: '晴',
      icon: 'sunny',
      humidity: '45%',
      wind: '东北风 3级',
      updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  },

  // ==================== 工具列表接口 ====================
  'GET /api/tools': {
    code: 200,
    message: 'success',
    data: {
      total: 160,
      categories: [
        { name: '视频工具', icon: 'icon-video', count: 10 },
        { name: '音频工具', icon: 'icon-audio', count: 6 },
        { name: '图片工具', icon: 'icon-image', count: 30 },
        { name: 'PDF工具', icon: 'icon-pdf', count: 9 },
        { name: '文本工具', icon: 'icon-text', count: 16 },
        { name: '文字应用', icon: 'icon-text-app', count: 15 },
        { name: '编程工具', icon: 'icon-code', count: 8 },
        { name: '编程应用', icon: 'icon-code-app', count: 20 },
        { name: '加密应用', icon: 'icon-lock', count: 3 },
        { name: '二维码工具', icon: 'icon-qrcode', count: 4 },
        { name: '单位转换', icon: 'icon-convert', count: 7 },
        { name: '实用工具', icon: 'icon-tools', count: 12 },
        { name: '生活应用', icon: 'icon-life', count: 4 },
        { name: '其他应用', icon: 'icon-other', count: 3 },
        { name: '查询工具', icon: 'icon-search', count: 20 },
        { name: '资讯工具', icon: 'icon-news', count: 5 },
        { name: '系统工具', icon: 'icon-system', count: 2 },
      ],
    },
  },

  // ==================== 用户注册接口 ====================
  'POST /api/auth/register': (req: any, res: any) => {
    const { username, email, password, nickname } = req.body;

    if (!username || !email || !password) {
      return res.json({ code: 400, message: '用户名、邮箱和密码不能为空', data: null });
    }
    if (mockUsers[username]) {
      return res.json({ code: 409, message: '用户名已存在', data: null });
    }
    const emailExists = Object.values(mockUsers).some((u: any) => u.email === email);
    if (emailExists) {
      return res.json({ code: 409, message: '邮箱已被注册', data: null });
    }

    const userId = `user_${Date.now()}`;
    const newUser = {
      id: userId,
      username,
      nickname: nickname || username,
      email,
      passwordHash: hashPassword(password),
      avatar: '',
      role: 'user',
      settings: { notificationEnabled: true, theme: 'light', language: 'zh-CN' },
      readAnnouncements: [],
      createdAt: new Date().toISOString(),
    };
    mockUsers[username] = newUser;

    const token = generateToken(userId);
    res.json({
      code: 200,
      message: '注册成功',
      data: {
        token,
        expiresIn: 7 * 24 * 3600, // 7天
        userInfo: {
          id: newUser.id,
          username: newUser.username,
          nickname: newUser.nickname,
          email: newUser.email,
          avatar: newUser.avatar,
          role: newUser.role,
          settings: newUser.settings,
        },
      },
    });
  },

  // ==================== 用户登录接口 ====================
  'POST /api/auth/login': (req: any, res: any) => {
    const { account, password } = req.body; // account 可以是用户名或邮箱

    if (!account || !password) {
      return res.json({ code: 400, message: '账号和密码不能为空', data: null });
    }

    // 查找用户（支持用户名或邮箱登录）
    const user = Object.values(mockUsers).find(
      (u: any) => u.username === account || u.email === account,
    ) as any;

    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.json({ code: 401, message: '账号或密码错误', data: null });
    }

    const token = generateToken(user.id);
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        expiresIn: 7 * 24 * 3600,
        userInfo: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          settings: user.settings,
        },
      },
    });
  },

  // ==================== 获取用户 Profile ====================
  'GET /api/user/profile': (req: any, res: any) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const userId = activeSessions[token];
    const user = Object.values(mockUsers).find((u: any) => u.id === userId) as any;

    if (!user) {
      return res.json({ code: 401, message: '未登录或登录已过期', data: null });
    }
    res.json({
      code: 200,
      message: 'success',
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        settings: user.settings,
      },
    });
  },

  // ==================== 更新用户设置 ====================
  'PUT /api/user/settings': (req: any, res: any) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const userId = activeSessions[token];
    const user = Object.values(mockUsers).find((u: any) => u.id === userId) as any;

    if (!user) {
      return res.json({ code: 401, message: '未登录或登录已过期', data: null });
    }
    Object.assign(user.settings, req.body);
    res.json({ code: 200, message: '设置已保存', data: user.settings });
  },

  // ==================== 获取公告列表 ====================
  'GET /api/announcements/list': (req: any, res: any) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const userId = activeSessions[token];
    const user = Object.values(mockUsers).find((u: any) => u.id === userId) as any;

    const activeAnnouncements = mockAnnouncements.filter((a) => a.isActive);

    if (user) {
      // 登录用户：附带已读状态
      const list = activeAnnouncements.map((a) => ({
        ...a,
        isRead: user.readAnnouncements.includes(a.id),
      }));
      return res.json({ code: 200, message: 'success', data: list });
    }

    // 未登录用户：全部标记为未读
    const list = activeAnnouncements.map((a) => ({ ...a, isRead: false }));
    res.json({ code: 200, message: 'success', data: list });
  },

  // ==================== 标记公告已读 ====================
  'POST /api/announcements/mark-read': (req: any, res: any) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const userId = activeSessions[token];
    const user = Object.values(mockUsers).find((u: any) => u.id === userId) as any;
    const { announcementId } = req.body;

    if (!announcementId) {
      return res.json({ code: 400, message: 'announcementId 不能为空', data: null });
    }

    if (user && !user.readAnnouncements.includes(announcementId)) {
      user.readAnnouncements.push(announcementId);
    }

    res.json({ code: 200, message: '已标记为已读', data: null });
  },

  // ==================== 检查新公告 ====================
  'GET /api/announcements/unread': (req: any, res: any) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const userId = activeSessions[token];
    const user = Object.values(mockUsers).find((u: any) => u.id === userId) as any;

    const activeAnnouncements = mockAnnouncements.filter((a) => a.isActive);

    if (user) {
      const unread = activeAnnouncements.filter((a) => !user.readAnnouncements.includes(a.id));
      return res.json({ code: 200, message: 'success', data: unread });
    }

    // 未登录用户返回所有公告（由前端用 localStorage 判断已读）
    res.json({ code: 200, message: 'success', data: activeAnnouncements });
  },

  // ==================== 旧版登录接口（兼容） ====================
  'POST /api/login': (req: any, res: any) => {
    const { username, password } = req.body;
    if (username && password) {
      res.json({
        code: 200,
        message: '登录成功',
        data: {
          token: 'mock-token-' + Date.now(),
          userInfo: { id: 1, username, nickname: username, avatar: '', email: `${username}@example.com` },
        },
      });
    } else {
      res.json({ code: 400, message: '账号或密码不能为空', data: null });
    }
  },

  // ==================== 用户信息接口（旧版兼容） ====================
  'GET /api/user/info': {
    code: 200,
    message: 'success',
    data: { id: 1, username: 'admin', nickname: '管理员', avatar: '', email: 'admin@example.com', role: 'admin' },
  },

  // ==================== 搜索接口 ====================
  'GET /api/search': (req: any, res: any) => {
    const { keyword = '', page = 1, pageSize = 20 } = req.query;
    res.json({
      code: 200,
      message: 'success',
      data: { keyword, page: Number(page), pageSize: Number(pageSize), total: 0, list: [] },
    });
  },
};
