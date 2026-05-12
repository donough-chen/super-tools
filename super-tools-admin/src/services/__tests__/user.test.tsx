/**
 * user service 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 */
import {
  listUsers, getUser, createUser, updateUser, deleteUser,
  resetUserPassword, changeUserStatus, listUserDevices, listUserAddresses,
} from '@/services/user';

jest.mock('@/utils/request');
import request from '@/utils/request';

describe('user service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listUsers → GET /api/users + params', async () => {
    await listUsers({ page: 2, pageSize: 50, keyword: 'alice' });
    expect(request).toHaveBeenCalledWith('/api/users', {
      params: { page: 2, pageSize: 50, keyword: 'alice' },
    });
  });

  it('getUser → GET /api/users/:id', async () => {
    await getUser(7);
    expect(request).toHaveBeenCalledWith('/api/users/7');
  });

  it('createUser → POST /api/users + body', async () => {
    await createUser({ username: 'bob', password: 'p@ssw0rd' });
    expect(request).toHaveBeenCalledWith('/api/users', {
      method: 'POST',
      data: { username: 'bob', password: 'p@ssw0rd' },
    });
  });

  it('updateUser → PUT /api/users/:id + body', async () => {
    await updateUser(7, { nickname: 'B' });
    expect(request).toHaveBeenCalledWith('/api/users/7', {
      method: 'PUT',
      data: { nickname: 'B' },
    });
  });

  it('deleteUser → DELETE /api/users/:id', async () => {
    await deleteUser(7);
    expect(request).toHaveBeenCalledWith('/api/users/7', { method: 'DELETE' });
  });

  it('resetUserPassword → POST /api/admin/users/:id/reset-password + body { newPassword }', async () => {
    await resetUserPassword(7, 'newP@ss123');
    expect(request).toHaveBeenCalledWith('/api/admin/users/7/reset-password', {
      method: 'POST',
      data: { newPassword: 'newP@ss123' },
    });
  });

  it('changeUserStatus → PUT /api/admin/users/:id/status + body { status }', async () => {
    await changeUserStatus(7, 0);
    expect(request).toHaveBeenCalledWith('/api/admin/users/7/status', {
      method: 'PUT',
      data: { status: 0 },
    });
  });

  it('listUserDevices → GET /api/admin/users/:id/devices', async () => {
    await listUserDevices(7);
    expect(request).toHaveBeenCalledWith('/api/admin/users/7/devices');
  });

  it('listUserAddresses → GET /api/admin/users/:id/addresses', async () => {
    await listUserAddresses(7);
    expect(request).toHaveBeenCalledWith('/api/admin/users/7/addresses');
  });
});
