/**
 * Mock 数据
 * 开发环境下模拟接口返回
 */
export default {
  'GET /api/getDemoData': (req: any, res: any) => {
    res.json({
      code: 0,
      data: {
        message: '这是 Mock 数据，开发环境专用',
        list: [
          { id: 1, name: '示例数据 1' },
          { id: 2, name: '示例数据 2' },
        ],
      },
    });
  },
};
