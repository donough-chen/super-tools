import request from '@/utils/request';

/** GET /api/admin/auth/menus — 当前用户菜单树 */
export const fetchMenusApi = (): Promise<ApiResponse<MenuNode[]>> =>
  request.get('/api/admin/auth/menus');

/** GET /api/admin/auth/permissions — 当前用户权限码 */
export const fetchPermissionsApi = (): Promise<ApiResponse<string[]>> =>
  request.get('/api/admin/auth/permissions');
