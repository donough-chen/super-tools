/**
 * role service 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 */
import { listRoles, createRole, assignRolePermissions } from '@/services/role';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('role service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listRoles → GET /api/admin/roles + params', async () => {
    await listRoles({ page: 2, pageSize: 50, keyword: 'admin' });
    expect(request).toHaveBeenCalledWith('/api/admin/roles', {
      params: { page: 2, pageSize: 50, keyword: 'admin' },
    });
  });

  it('createRole → POST + body', async () => {
    await createRole({ code: 'ops', name: '运营' });
    expect(request).toHaveBeenCalledWith('/api/admin/roles', {
      method: 'POST',
      data: { code: 'ops', name: '运营' },
    });
  });

  it('assignRolePermissions → PUT /:id/permissions + body { permissionIds }', async () => {
    await assignRolePermissions(5, [1, 2, 3]);
    expect(request).toHaveBeenCalledWith('/api/admin/roles/5/permissions', {
      method: 'PUT',
      data: { permissionIds: [1, 2, 3] },
    });
  });
});
