/**
 * member service 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 */
import {
  listLevels, updateLevel, listPlans, updatePlan,
  listMemberUsers, getMemberUser, adjustPoints, adjustLevel, activatePlan,
  getMemberStats, listPointsLogs,
} from '@/services/member';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('member service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listLevels → GET /api/admin/member/levels', async () => {
    await listLevels();
    expect(request).toHaveBeenCalledWith('/api/admin/member/levels');
  });

  it('updateLevel → PUT /levels/:id + body', async () => {
    await updateLevel(2, { name: '白银', sort: 10 });
    expect(request).toHaveBeenCalledWith('/api/admin/member/levels/2', {
      method: 'PUT',
      data: { name: '白银', sort: 10 },
    });
  });

  it('listPlans → GET /plans', async () => {
    await listPlans();
    expect(request).toHaveBeenCalledWith('/api/admin/member/plans');
  });

  it('updatePlan → PUT /plans/:id + body', async () => {
    await updatePlan(3, { price: 99 });
    expect(request).toHaveBeenCalledWith('/api/admin/member/plans/3', {
      method: 'PUT',
      data: { price: 99 },
    });
  });

  it('listMemberUsers → GET /users + params', async () => {
    await listMemberUsers({ page: 1, pageSize: 20, levelCode: 'silver' });
    expect(request).toHaveBeenCalledWith('/api/admin/member/users', {
      params: { page: 1, pageSize: 20, levelCode: 'silver' },
    });
  });

  it('getMemberUser → GET /users/:id', async () => {
    await getMemberUser(7);
    expect(request).toHaveBeenCalledWith('/api/admin/member/users/7');
  });

  it('adjustPoints → POST /users/:id/adjust-points + body', async () => {
    await adjustPoints(7, 100, 0, '双 11 补偿');
    expect(request).toHaveBeenCalledWith('/api/admin/member/users/7/adjust-points', {
      method: 'POST',
      data: { points: 100, growthDelta: 0, remark: '双 11 补偿' },
    });
  });

  it('adjustLevel → PUT /users/:id/level + body { levelId }', async () => {
    await adjustLevel(7, 3);
    expect(request).toHaveBeenCalledWith('/api/admin/member/users/7/level', {
      method: 'PUT',
      data: { levelId: 3 },
    });
  });

  it('activatePlan → POST /users/:id/activate-plan + body { planCode }', async () => {
    await activatePlan(7, 'monthly');
    expect(request).toHaveBeenCalledWith('/api/admin/member/users/7/activate-plan', {
      method: 'POST',
      data: { planCode: 'monthly' },
    });
  });

  it('getMemberStats → GET /stats', async () => {
    await getMemberStats();
    expect(request).toHaveBeenCalledWith('/api/admin/member/stats');
  });

  it('listPointsLogs → GET /points-logs + params', async () => {
    await listPointsLogs({ page: 1, userId: 5, type: 1 });
    expect(request).toHaveBeenCalledWith('/api/admin/member/points-logs', {
      params: { page: 1, userId: 5, type: 1 },
    });
  });
});
