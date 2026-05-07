/**
 * Mock 数据
 * 开发环境下模拟接口返回
 */
export default {
  // ==================== Banner ====================
  'GET /api/banner/list': (req: any, res: any) => {
    res.json({
      code: 200,
      data: [
        { id: '1', imageUrl: 'https://via.placeholder.com/750x300', linkUrl: '/featured', title: '新功能上线' },
        { id: '2', imageUrl: 'https://via.placeholder.com/750x300', linkUrl: '/member', title: '会员专享特权' },
        { id: '3', imageUrl: 'https://via.placeholder.com/750x300', linkUrl: '/about', title: '了解更多' },
      ],
    });
  },

  // ==================== 工具分类 ====================
  'GET /api/tool/categories': (req: any, res: any) => {
    res.json({
      code: 200,
      data: [
        {
          id: 'cat-1', name: '热门应用', icon: '',
          tools: [
            { id: 't-1', name: '万能解析', fontClass: 'icon-placeholder', iconTheme: 'orange', category: 'cat-1', url: '/tool/parser', contentType: 'native' },
            { id: 't-2', name: '主页解析', fontClass: 'icon-placeholder', iconTheme: 'green', category: 'cat-1', url: '/tool/homepage', contentType: 'native' },
            { id: 't-3', name: '全能下载器', fontClass: 'icon-placeholder', iconTheme: 'blue', category: 'cat-1', url: '/tool/downloader', contentType: 'native' },
            { id: 't-4', name: '即时热榜', fontClass: 'icon-placeholder', iconTheme: 'purple', category: 'cat-1', url: '/tool/hotlist', contentType: 'native' },
            { id: 't-5', name: '新闻资讯', fontClass: 'icon-placeholder', iconTheme: 'teal', category: 'cat-1', url: '/tool/news', contentType: 'native' },
            { id: 't-6', name: '60秒早报', fontClass: 'icon-placeholder', iconTheme: 'indigo', category: 'cat-1', url: '/tool/morning', contentType: 'native' },
            { id: 't-7', name: '配料识别', fontClass: 'icon-placeholder', iconTheme: 'amber', category: 'cat-1', url: '/tool/ingredient', contentType: 'native' },
            { id: 't-8', name: '药品分析', fontClass: 'icon-placeholder', iconTheme: 'green', category: 'cat-1', url: '/tool/medicine', contentType: 'native' },
            { id: 't-9', name: '文本转语音', fontClass: 'icon-placeholder', iconTheme: 'pink', category: 'cat-1', url: '/tool/tts', contentType: 'native' },
            { id: 't-10', name: '全网搜索', fontClass: 'icon-placeholder', iconTheme: 'red', category: 'cat-1', url: '/tool/search', contentType: 'native' },
            { id: 't-11', name: '智感握姿检测', fontClass: 'icon-placeholder', iconTheme: 'cyan', category: 'cat-1', url: '/tool/gesture', contentType: 'native' },
            { id: 't-12', name: '鸿蒙装机量', fontClass: 'icon-placeholder', iconTheme: 'blue', category: 'cat-1', url: '/tool/harmonyos', contentType: 'native' },
            { id: 't-13', name: '歌曲壁纸', fontClass: 'icon-placeholder', iconTheme: 'purple', category: 'cat-1', url: '/tool/wallpaper', contentType: 'native' },
            { id: 't-14', name: '悬浮计时', fontClass: 'icon-placeholder', iconTheme: 'orange', category: 'cat-1', url: '/tool/timer', contentType: 'native' },
            { id: 't-15', name: 'AR测距', fontClass: 'icon-placeholder', iconTheme: 'teal', category: 'cat-1', url: '/tool/ar-measure', contentType: 'native' },
            { id: 't-16', name: '今日黄金价格', fontClass: 'icon-placeholder', iconTheme: 'amber', category: 'cat-1', url: '/tool/gold-price', contentType: 'native' },
          ],
        },
        {
          id: 'cat-2', name: '特色应用', icon: '',
          tools: [
            { id: 't-17', name: '资源嗅探', subtitle: '网页资源智能嗅探', fontClass: 'icon-placeholder', iconTheme: 'green', category: 'cat-2', url: '/tool/sniffer', contentType: 'native' },
            { id: 't-18', name: '做个决定', subtitle: '随机决策小帮手', fontClass: 'icon-placeholder', iconTheme: 'orange', category: 'cat-2', url: '/tool/decision', contentType: 'native' },
            { id: 't-19', name: '文档扫描', subtitle: '手机变扫描仪', fontClass: 'icon-placeholder', iconTheme: 'indigo', category: 'cat-2', url: '/tool/doc-scan', contentType: 'native' },
            { id: 't-20', name: '实时语音转录', subtitle: '语音实时转文字', fontClass: 'icon-placeholder', iconTheme: 'purple', category: 'cat-2', url: '/tool/voice-record', contentType: 'native' },
            { id: 't-21', name: '实况计时', subtitle: '灵动岛实时计时', fontClass: 'icon-placeholder', iconTheme: 'teal', category: 'cat-2', url: '/tool/live-timer', contentType: 'native' },
            { id: 't-22', name: '图片抠图', subtitle: 'AI 智能抠图去背景', fontClass: 'icon-placeholder', iconTheme: 'pink', category: 'cat-2', url: '/tool/cutout', contentType: 'native' },
            { id: 't-23', name: '人脸打码', subtitle: '一键人脸马赛克', fontClass: 'icon-placeholder', iconTheme: 'red', category: 'cat-2', url: '/tool/face-blur', contentType: 'native' },
            { id: 't-24', name: '人脸对比', subtitle: 'AI 人脸相似度对比', fontClass: 'icon-placeholder', iconTheme: 'cyan', category: 'cat-2', url: '/tool/face-compare', contentType: 'native' },
            { id: 't-25', name: '画板', subtitle: '自由涂鸦创作画板', fontClass: 'icon-placeholder', iconTheme: 'blue', category: 'cat-2', url: '/tool/canvas', contentType: 'native' },
            { id: 't-26', name: '文本朗读', subtitle: '文字转语音朗读', fontClass: 'icon-placeholder', iconTheme: 'amber', category: 'cat-2', url: '/tool/read-aloud', contentType: 'native' },
            { id: 't-27', name: '应用图标', subtitle: '提取 App 高清图标', fontClass: 'icon-placeholder', iconTheme: 'green', category: 'cat-2', url: '/tool/app-icon', contentType: 'native' },
            { id: 't-28', name: '文字识别', subtitle: 'OCR 图片文字提取', fontClass: 'icon-placeholder', iconTheme: 'orange', category: 'cat-2', url: '/tool/ocr', contentType: 'native' },
            { id: 't-29', name: '白噪音', subtitle: '助眠白噪音播放器', fontClass: 'icon-placeholder', iconTheme: 'teal', category: 'cat-2', url: '/tool/white-noise', contentType: 'native' },
            { id: 't-30', name: '动态照片压缩', subtitle: 'Live Photo 无损压缩', fontClass: 'icon-placeholder', iconTheme: 'indigo', category: 'cat-2', url: '/tool/live-compress', contentType: 'native' },
            { id: 't-31', name: '动态照片转视频', subtitle: 'Live Photo 转 MP4', fontClass: 'icon-placeholder', iconTheme: 'purple', category: 'cat-2', url: '/tool/live-to-video', contentType: 'native' },
            { id: 't-32', name: '视频转动态照片', subtitle: '视频转 Live Photo', fontClass: 'icon-placeholder', iconTheme: 'pink', category: 'cat-2', url: '/tool/video-to-live', contentType: 'native' },
          ],
        },
      ],
    });
  },

  // ==================== 搜索 ====================
  'GET /api/tool/search': (req: any, res: any) => {
    const { keyword = '' } = req.query;
    res.json({
      code: 200,
      data: [
        { id: 't-1', name: 'JSON 格式化', icon: '', subtitle: '在线 JSON 美化工具', category: 'cat-1', url: '/tool/json', contentType: 'native' },
      ].filter(item => item.name.includes(keyword)),
    });
  },

  // ==================== 收藏 ====================
  'GET /api/favorite/list': (req: any, res: any) => {
    res.json({
      code: 200,
      data: [
        { id: 't-1', name: 'JSON 格式化', icon: '', subtitle: '在线 JSON 美化工具', category: 'cat-1', url: '/tool/json', contentType: 'native' },
        { id: 't-5', name: '图片压缩', icon: '', subtitle: '在线图片压缩', category: 'cat-2', url: '/tool/compress', contentType: 'native' },
      ],
    });
  },

  'POST /api/favorite/add': (req: any, res: any) => {
    res.json({ code: 200, data: true });
  },

  'POST /api/favorite/remove': (req: any, res: any) => {
    res.json({ code: 200, data: true });
  },

  // ==================== 特色 ====================
  'GET /api/featured/list': (req: any, res: any) => {
    const { type } = req.query;
    const list = type === 'vip'
      ? [
          { id: 'f-1', name: 'AI 智能写作', icon: '', subtitle: '会员专享', category: 'vip', url: '/tool/ai-writer', contentType: 'native' },
        ]
      : [
          { id: 'f-2', name: '密码生成器', icon: '', subtitle: '安全随机密码', category: 'featured', url: '/tool/password', contentType: 'native' },
          { id: 'f-3', name: '二维码生成', icon: '', subtitle: '自定义二维码', category: 'featured', url: '/tool/qrcode', contentType: 'native' },
        ];
    res.json({ code: 200, data: list });
  },

  // ==================== 网站 ====================
  'GET /api/site/categories': (req: any, res: any) => {
    res.json({
      code: 200,
      data: [
        { id: 'sc-1', name: '开发', icon: '' },
        { id: 'sc-2', name: '设计', icon: '' },
        { id: 'sc-3', name: '产品', icon: '' },
        { id: 'sc-4', name: '运营', icon: '' },
        { id: 'sc-5', name: 'AI', icon: '' },
      ],
    });
  },

  'GET /api/site/list': (req: any, res: any) => {
    res.json({
      code: 200,
      data: [
        { id: 's-1', name: 'GitHub', icon: '', url: 'https://github.com', userCount: 12890, favCount: 5670, createdAt: '2024-01-01' },
        { id: 's-2', name: 'Stack Overflow', icon: '', url: 'https://stackoverflow.com', userCount: 8900, favCount: 3210, createdAt: '2024-02-01' },
      ],
    });
  },

  // ==================== 认证 Auth ====================
  // 'POST /api/auth/login': (req: any, res: any) => {
  //   const { username, password } = req.body;
  //   if (!username || !password) {
  //     res.status(422).json({ code: 422, message: '请输入账号和密码', data: null });
  //     return;
  //   }
  //   if (username === 'admin' && password === 'Admin@123456') {
  //     res.json({
  //       code: 200,
  //       data: {
  //         accessToken: 'mock_access_token_' + Date.now(),
  //         refreshToken: 'mock_refresh_token_' + Date.now(),
  //         expiresIn: 7200,
  //         user: {
  //           id: 1,
  //           uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  //           username: 'admin',
  //           nickname: '超级管理员',
  //           avatar: 'https://via.placeholder.com/100',
  //           email: 'admin@supertools.com',
  //           phone: '138****8888',
  //           userType: 3,
  //           status: 1,
  //         },
  //       },
  //     });
  //   } else {
  //     res.status(401).json({ code: 401, message: '账号或密码错误', data: null });
  //   }
  // },

  // 'POST /api/auth/register': (req: any, res: any) => {
  //   const { username, email, password } = req.body;
  //   if (!username || !email || !password) {
  //     res.status(422).json({ code: 422, message: '请填写完整注册信息', data: null });
  //     return;
  //   }
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 2,
  //       uuid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  //       username,
  //       createdAt: new Date().toISOString(),
  //     },
  //   });
  // },

  // 'POST /api/auth/refresh': (req: any, res: any) => {
  //   const { refreshToken } = req.body;
  //   if (!refreshToken) {
  //     res.status(422).json({ code: 422, message: '缺少 refreshToken', data: null });
  //     return;
  //   }
  //   res.json({
  //     code: 200,
  //     data: {
  //       accessToken: 'mock_new_access_token_' + Date.now(),
  //       refreshToken: 'mock_new_refresh_token_' + Date.now(),
  //       expiresIn: 7200,
  //       user: {
  //         id: 1,
  //         uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  //         username: 'admin',
  //         nickname: '超级管理员',
  //         avatar: 'https://via.placeholder.com/100',
  //         email: 'admin@supertools.com',
  //         phone: '138****8888',
  //         userType: 3,
  //         status: 1,
  //       },
  //     },
  //   });
  // },

  // 'POST /api/auth/send-code': (req: any, res: any) => {
  //   res.json({ code: 200, data: true });
  // },

  // 'POST /api/auth/logout': (req: any, res: any) => {
  //   res.json({ code: 200, data: true });
  // },

  // 'GET /api/users/profile': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 1,
  //       uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  //       username: 'admin',
  //       nickname: '超级管理员',
  //       avatar: 'https://via.placeholder.com/100',
  //       email: 'admin@supertools.com',
  //       phone: '138****8888',
  //       gender: 1,
  //       birthday: null,
  //       userType: 3,
  //       status: 1,
  //       isVerified: false,
  //       registerSource: 'web',
  //       lastLoginAt: '2026-04-09T10:00:00.000Z',
  //       createdAt: '2026-04-01T00:00:00.000Z',
  //     },
  //   });
  // },

  // ==================== 会员 ====================
  'GET /api/member/info': (req: any, res: any) => {
    res.json({
      code: 200,
      data: {
        level: { id: 3, name: '金牌会员', code: 'gold', level: 3, icon: null, color: '#fa8c16' },
        growthValue: 1580,
        totalPoints: 2800,
        points: 1580,
        totalConsume: 0,
        nextLevel: { name: '钻石会员', code: 'diamond', upgradeGrowth: 5000, progress: 32, remaining: 3420 },
        paid: { isPaid: false },
        // V1 兼容：旧 member 页直接从 /api/member/info.data.plans 取数据
        // V2 后会迁移到独立的 /api/member/plans 接口
        plans: [
          { id: 'p-1', name: '月度会员', price: 9.9, duration: 30, description: '畅享所有高级工具' },
          { id: 'p-2', name: '年度会员', price: 68, duration: 365, description: '全年无忧，超值之选' },
        ],
      },
    });
  },

  // ==================== 认证 Auth ====================
  // 通用 mock：验证码统一 "123456"，refresh-token 永远成功

  // /** 发送验证码：mock 总是成功 */
  // 'POST /api/auth/send-code': (req: any, res: any) => {
  //   res.json({ code: 200, data: { message: '验证码已发送（mock：使用 123456）', expiresIn: 300 } });
  // },

  // /** 账号密码登录：admin / Admin@123 → 成功 */
  // 'POST /api/auth/login': (req: any, res: any) => {
  //   const { username, password } = req.body || {};
  //   if (username === 'admin' && password === 'Admin@123') {
  //     return res.json({
  //       code: 200,
  //       data: {
  //         accessToken: 'mock-access-token-' + Date.now(),
  //         refreshToken: 'mock-refresh-token-' + Date.now(),
  //         expiresIn: 7200,
  //         sessionId: 'mock-session-current',
  //         isNewUser: false,
  //         user: {
  //           id: 1, uuid: 'uuid-admin', username: 'admin', email: 'admin@example.com',
  //           phone: '13800138000', nickname: '管理员', avatar: '', gender: 1, birthday: '1990-01-01',
  //           userType: 2, status: 1, isVerified: true, registerSource: 'h5',
  //           lastLoginAt: new Date().toISOString(), createdAt: '2025-01-01T00:00:00Z',
  //         },
  //       },
  //     });
  //   }
  //   return res.status(400).json({ code: 100101, message: '账号或密码错误', data: null });
  // },

  // /** 手机号验证码登录：必须 123456，13800138000 老用户/其他新用户 */
  // 'POST /api/auth/phone-login': (req: any, res: any) => {
  //   const { phone, code } = req.body || {};
  //   if (code !== '123456') {
  //     return res.status(400).json({ code: 100301, message: '验证码错误或已过期', data: null });
  //   }
  //   const isNewUser = phone !== '13800138000';
  //   return res.json({
  //     code: 200,
  //     data: {
  //       accessToken: 'mock-access-token-' + Date.now(),
  //       refreshToken: 'mock-refresh-token-' + Date.now(),
  //       expiresIn: 7200,
  //       sessionId: 'mock-session-current',
  //       isNewUser,
  //       user: {
  //         id: isNewUser ? 1001 : 1, uuid: isNewUser ? 'uuid-new' : 'uuid-admin',
  //         username: null, email: null, phone, nickname: isNewUser ? '新用户' : '管理员',
  //         avatar: '', gender: 0, birthday: null, userType: 1, status: 1,
  //         isVerified: true, registerSource: 'h5',
  //         lastLoginAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  //       },
  //     },
  //   });
  // },

  // /** 邮箱+密码注册 */
  // 'POST /api/auth/register': (req: any, res: any) => {
  //   res.json({ code: 200, data: { id: 9001, uuid: 'uuid-new-' + Date.now() } });
  // },

  // /** Refresh Token */
  // 'POST /api/auth/refresh': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       accessToken: 'mock-access-token-refreshed-' + Date.now(),
  //       refreshToken: 'mock-refresh-token-refreshed-' + Date.now(),
  //       expiresIn: 7200,
  //       sessionId: 'mock-session-current',
  //     },
  //   });
  // },

  // /** 退出登录 */
  // 'POST /api/auth/logout': (req: any, res: any) => {
  //   res.json({ code: 200, data: null });
  // },

  // /** 绑定手机号 */
  // 'POST /api/auth/bind/phone': (req: any, res: any) => {
  //   if ((req.body && req.body.code) !== '123456') {
  //     return res.status(400).json({ code: 100301, message: '验证码错误或已过期', data: null });
  //   }
  //   return res.json({ code: 200, data: { message: '手机号绑定成功' } });
  // },

  // /** 绑定邮箱 */
  // 'POST /api/auth/bind/email': (req: any, res: any) => {
  //   if ((req.body && req.body.code) !== '123456') {
  //     return res.status(400).json({ code: 100301, message: '验证码错误或已过期', data: null });
  //   }
  //   return res.json({ code: 200, data: { message: '邮箱绑定成功' } });
  // },

  // /** 解绑 */
  // 'POST /api/auth/unbind': (req: any, res: any) => {
  //   res.json({ code: 200, data: { message: '解绑成功' } });
  // },

  // /** 绑定状态查询 */
  // 'GET /api/auth/bind-status': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       hasPassword: true,
  //       phone: '13800138000',
  //       email: 'admin@example.com',
  //       wechat: [],
  //     },
  //   });
  // },

  // /** 活跃会话列表 */
  // 'GET /api/auth/sessions': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: [
  //       {
  //         sessionId: 'mock-session-current',
  //         platform: 'h5', ip: '192.168.1.10', deviceName: 'Chrome 120',
  //         location: '广东深圳', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  //       },
  //       {
  //         sessionId: 'mock-session-other',
  //         platform: 'web', ip: '203.0.113.5', deviceName: 'Safari 17',
  //         location: '上海', createdAt: new Date(Date.now() - 86400000).toISOString(),
  //       },
  //     ],
  //   });
  // },

  // /** 踢下线会话 */
  // 'DELETE /api/auth/sessions/:id': (req: any, res: any) => {
  //   res.json({ code: 200, data: null });
  // },

  // // ==================== 用户资料 User ====================

  // 'GET /api/users/profile': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 1, uuid: 'uuid-admin', username: 'admin', email: 'admin@example.com',
  //       phone: '13800138000', nickname: '管理员', avatar: '',
  //       gender: 1, birthday: '1990-01-01', userType: 2, status: 1,
  //       isVerified: true, registerSource: 'h5',
  //       lastLoginAt: new Date().toISOString(), createdAt: '2025-01-01T00:00:00Z',
  //     },
  //   });
  // },

  // 'GET /api/users/profile/extra': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 1, uuid: 'uuid-admin', username: 'admin', email: 'admin@example.com',
  //       phone: '13800138000', nickname: '管理员', avatar: '',
  //       gender: 1, birthday: '1990-01-01', userType: 2, status: 1,
  //       isVerified: true, registerSource: 'h5',
  //       lastLoginAt: new Date().toISOString(), createdAt: '2025-01-01T00:00:00Z',
  //       profile: {
  //         bio: '专注于工具效率的产品爱好者',
  //         signature: '简单即美',
  //         regionCode: '广东深圳',
  //         language: 'zh-CN',
  //         timezone: 'Asia/Shanghai',
  //         referralCode: 'AB12CD34',
  //         invitedBy: null,
  //         privacySettings: { showPhone: false, showEmail: false, showOnlineStatus: true },
  //         notificationSettings: { push: true, sms: true, email: true },
  //       },
  //     },
  //   });
  // },

  // 'PUT /api/users/profile': (req: any, res: any) => {
  //   const body = req.body || {};
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 1, uuid: 'uuid-admin', username: 'admin', email: 'admin@example.com',
  //       phone: '13800138000',
  //       nickname: body.nickname !== undefined ? body.nickname : '管理员',
  //       avatar: body.avatar !== undefined ? body.avatar : '',
  //       gender: body.gender !== undefined ? body.gender : 1,
  //       birthday: body.birthday !== undefined ? body.birthday : '1990-01-01',
  //       userType: 2, status: 1, isVerified: true, registerSource: 'h5',
  //       lastLoginAt: new Date().toISOString(), createdAt: '2025-01-01T00:00:00Z',
  //       profile: {
  //         bio: body.bio !== undefined ? body.bio : '专注于工具效率的产品爱好者',
  //         signature: body.signature !== undefined ? body.signature : '简单即美',
  //         regionCode: body.regionCode !== undefined ? body.regionCode : '广东深圳',
  //         language: body.language !== undefined ? body.language : 'zh-CN',
  //         timezone: body.timezone !== undefined ? body.timezone : 'Asia/Shanghai',
  //         referralCode: 'AB12CD34',
  //         invitedBy: null,
  //         privacySettings: body.privacySettings !== undefined ? body.privacySettings : { showPhone: false, showEmail: false, showOnlineStatus: true },
  //         notificationSettings: body.notificationSettings !== undefined ? body.notificationSettings : { push: true, sms: true, email: true },
  //       },
  //     },
  //   });
  // },

  // /** 修改密码：原密码必须 Admin@123 */
  // 'PUT /api/users/password': (req: any, res: any) => {
  //   const { oldPassword } = req.body || {};
  //   if (oldPassword !== 'Admin@123') {
  //     return res.status(400).json({ code: 100204, message: '原密码不正确', data: null });
  //   }
  //   return res.json({ code: 200, data: null });
  // },

  // // ==================== 设备 Device ====================

  // 'POST /api/users/devices': (req: any, res: any) => {
  //   const body = req.body || {};
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 1, userId: 1, deviceId: body.deviceId,
  //       deviceName: body.deviceName, deviceType: body.deviceType,
  //       osVersion: body.osVersion, appVersion: body.appVersion,
  //       pushToken: null, pushEnabled: 1,
  //       lastActiveAt: new Date().toISOString(), status: 1,
  //     },
  //   });
  // },

  // 'GET /api/users/devices': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: [
  //       {
  //         id: 1, userId: 1, deviceId: 'h5-current-device',
  //         deviceName: 'Chrome 120', deviceType: 'h5',
  //         osVersion: 'macOS', appVersion: '1.0.0',
  //         pushToken: null, pushEnabled: 1,
  //         lastActiveAt: new Date().toISOString(), status: 1,
  //       },
  //       {
  //         id: 2, userId: 1, deviceId: 'h5-other-device',
  //         deviceName: 'Safari 17', deviceType: 'h5',
  //         osVersion: 'iOS 18.0', appVersion: '1.0.0',
  //         pushToken: null, pushEnabled: 0,
  //         lastActiveAt: new Date(Date.now() - 86400000).toISOString(), status: 1,
  //       },
  //     ],
  //   });
  // },

  // 'DELETE /api/users/devices/:deviceId': (req: any, res: any) => {
  //   res.json({ code: 200, data: { message: '设备已移除' } });
  // },

  // 'PUT /api/users/devices/:deviceId/push': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       id: 1, userId: 1, deviceId: req.params.deviceId,
  //       deviceName: 'Chrome 120', deviceType: 'h5',
  //       osVersion: 'macOS', appVersion: '1.0.0',
  //       pushToken: null,
  //       pushEnabled: req.body && req.body.pushEnabled ? 1 : 0,
  //       lastActiveAt: new Date().toISOString(), status: 1,
  //     },
  //   });
  // },
};
