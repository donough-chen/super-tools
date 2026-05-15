/**
 * Mock 数据
 * 开发环境下模拟接口返回
 *
 * 注：工具相关接口（banner/tool/featured）已迁移至后端新工具模块
 *     通过 .umirc.dev.ts 的 proxy 配置直连后端 localhost:7001
 *     本文件仅保留未迁移的旧接口 mock
 */
export default {
  // ==================== 收藏 ====================
  // 'GET /api/favorite/list': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: [
  //       { id: 't-1', name: 'JSON 格式化', icon: '', subtitle: '在线 JSON 美化工具', category: 'cat-1', url: '/tool/json', contentType: 'native' },
  //       { id: 't-5', name: '图片压缩', icon: '', subtitle: '在线图片压缩', category: 'cat-2', url: '/tool/compress', contentType: 'native' },
  //     ],
  //   });
  // },

  // 'POST /api/favorite/add': (req: any, res: any) => {
  //   res.json({ code: 200, data: true });
  // },

  // 'POST /api/favorite/remove': (req: any, res: any) => {
  //   res.json({ code: 200, data: true });
  // },

  // ==================== 网站 ====================
  // 'GET /api/site/categories': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: [
  //       { id: 'sc-1', name: '开发', icon: '' },
  //       { id: 'sc-2', name: '设计', icon: '' },
  //       { id: 'sc-3', name: '产品', icon: '' },
  //       { id: 'sc-4', name: '运营', icon: '' },
  //       { id: 'sc-5', name: 'AI', icon: '' },
  //     ],
  //   });
  // },

  // 'GET /api/site/list': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: [
  //       { id: 's-1', name: 'GitHub', icon: '', url: 'https://github.com', userCount: 12890, favCount: 5670, createdAt: '2024-01-01' },
  //       { id: 's-2', name: 'Stack Overflow', icon: '', url: 'https://stackoverflow.com', userCount: 8900, favCount: 3210, createdAt: '2024-02-01' },
  //     ],
  //   });
  // },

  // ==================== 会员 ====================
  // 'GET /api/member/info': (req: any, res: any) => {
  //   res.json({
  //     code: 200,
  //     data: {
  //       level: { id: 3, name: '金牌会员', code: 'gold', level: 3, icon: null, color: '#fa8c16' },
  //       growthValue: 1580,
  //       totalPoints: 2800,
  //       points: 1580,
  //       totalConsume: 0,
  //       nextLevel: { name: '钻石会员', code: 'diamond', upgradeGrowth: 5000, progress: 32, remaining: 3420 },
  //       paid: { isPaid: false },
  //       plans: [
  //         { id: 'p-1', name: '月度会员', price: 9.9, duration: 30, description: '畅享所有高级工具' },
  //         { id: 'p-2', name: '年度会员', price: 68, duration: 365, description: '全年无忧，超值之选' },
  //       ],
  //     },
  //   });
  // },
};
