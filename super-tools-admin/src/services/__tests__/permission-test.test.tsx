import { runPermissionTest } from '@/services/permission-test';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('permission-test service', () => {
  it('runPermissionTest user-check by code → query 全字段透传', async () => {
    await runPermissionTest({
      mode: 'user-check',
      userId: 1,
      code: 'tool:create',
    });
    expect(request).toHaveBeenCalledWith('/api/admin/permissions/test', {
      params: { mode: 'user-check', userId: 1, code: 'tool:create' },
    });
  });
});
