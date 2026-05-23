/**
 * admin order service 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest bug（与 C2a/C2b 一致）。
 */
import { listOrders, getOrder, getOrderStats } from '@/services/order';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('admin order service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listOrders → GET /api/admin/member/orders', async () => {
    await listOrders({ page: 1, pageSize: 20, status: 1 });
    expect(request).toHaveBeenCalledWith('/api/admin/member/orders', {
      params: { page: 1, pageSize: 20, status: 1 },
    });
  });

  it('getOrder → GET /api/admin/member/orders/:id', async () => {
    await getOrder(7);
    expect(request).toHaveBeenCalledWith('/api/admin/member/orders/7');
  });

  it('getOrderStats → GET /api/admin/member/orders/stats', async () => {
    await getOrderStats({ startDate: '2026-05-01', endDate: '2026-05-23' });
    expect(request).toHaveBeenCalledWith('/api/admin/member/orders/stats', {
      params: { startDate: '2026-05-01', endDate: '2026-05-23' },
    });
  });

  it('listOrders 不传参数 → params 为 undefined', async () => {
    await listOrders();
    expect(request).toHaveBeenCalledWith('/api/admin/member/orders', { params: undefined });
  });

  it('listOrders 仅传 userId', async () => {
    await listOrders({ userId: 5 });
    expect(request).toHaveBeenCalledWith('/api/admin/member/orders', {
      params: { userId: 5 },
    });
  });
});
