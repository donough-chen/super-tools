import { getPermissionTree, getPermission } from '@/services/permission';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('permission service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getPermissionTree → GET /tree', async () => {
    await getPermissionTree();
    expect(request).toHaveBeenCalledWith('/api/admin/permissions/tree');
  });

  it('getPermission → GET /:id', async () => {
    await getPermission(42);
    expect(request).toHaveBeenCalledWith('/api/admin/permissions/42');
  });
});
