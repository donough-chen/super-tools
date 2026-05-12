/**
 * feedback service 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 */
import {
  listFeedbacks, getFeedback, replyFeedback, updateFeedback, deleteFeedback,
} from '@/services/feedback';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('feedback service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listFeedbacks → GET /api/admin/feedbacks + params', async () => {
    await listFeedbacks({ page: 1, pageSize: 20, status: 0 });
    expect(request).toHaveBeenCalledWith('/api/admin/feedbacks', {
      params: { page: 1, pageSize: 20, status: 0 },
    });
  });

  it('getFeedback → GET /api/admin/feedbacks/:id', async () => {
    await getFeedback(7);
    expect(request).toHaveBeenCalledWith('/api/admin/feedbacks/7');
  });

  it('replyFeedback → POST /api/admin/feedbacks/:id/reply + body { replyContent }', async () => {
    await replyFeedback(7, 'thanks');
    expect(request).toHaveBeenCalledWith('/api/admin/feedbacks/7/reply', {
      method: 'POST',
      data: { replyContent: 'thanks' },
    });
  });

  it('updateFeedback → PUT /api/admin/feedbacks/:id + body { status }', async () => {
    await updateFeedback(7, { status: 1 });
    expect(request).toHaveBeenCalledWith('/api/admin/feedbacks/7', {
      method: 'PUT',
      data: { status: 1 },
    });
  });

  it('deleteFeedback → DELETE /api/admin/feedbacks/:id', async () => {
    await deleteFeedback(7);
    expect(request).toHaveBeenCalledWith('/api/admin/feedbacks/7', { method: 'DELETE' });
  });
});
