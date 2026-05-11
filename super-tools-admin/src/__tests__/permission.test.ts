import { hasPermission, findMenuByPath, findFirstLeaf } from '@/utils/permission';

const sampleTree: MenuNode[] = [
  { id: 1, code: 'dashboard', name: '仪表盘', module: 'dashboard', path: '/dashboard', icon: 'DashboardOutlined', sort: 10, children: [] },
  {
    id: 2, code: 'system', name: '系统管理', module: 'system', path: '/system', icon: 'SettingOutlined', sort: 90, children: [
      { id: 11, code: 'system:role', name: '角色管理', module: 'system', path: '/system/role', icon: null, sort: 10, children: [] },
      { id: 12, code: 'system:permission', name: '权限管理', module: 'system', path: '/system/permission', icon: null, sort: 20, children: [] },
    ]
  },
];

describe('utils/permission', () => {
  describe('hasPermission', () => {
    it('单码命中返回 true', () => {
      expect(hasPermission('user:list', ['user:list', 'user:detail'])).toBe(true);
    });
    it('单码未命中返回 false', () => {
      expect(hasPermission('user:create', ['user:list'])).toBe(false);
    });
    it('数组任一命中返回 true', () => {
      expect(hasPermission(['user:create', 'user:list'], ['user:list'])).toBe(true);
    });
    it('数组全未命中返回 false', () => {
      expect(hasPermission(['user:create', 'user:delete'], ['user:list'])).toBe(false);
    });
    it('空 owned 返回 false', () => {
      expect(hasPermission('user:list', [])).toBe(false);
    });
    it('required 为 null/空字符串/undefined 时穿透返回 true', () => {
      expect(hasPermission(null as any, [])).toBe(true);
      expect(hasPermission('', [])).toBe(true);
      expect(hasPermission(undefined as any, [])).toBe(true);
    });
  });

  describe('findMenuByPath', () => {
    it('根节点命中', () => {
      expect(findMenuByPath(sampleTree, '/dashboard')?.code).toBe('dashboard');
    });
    it('二级节点命中', () => {
      expect(findMenuByPath(sampleTree, '/system/role')?.code).toBe('system:role');
    });
    it('不存在的 path 返回 null', () => {
      expect(findMenuByPath(sampleTree, '/not-exist')).toBeNull();
    });
    it('空树返回 null', () => {
      expect(findMenuByPath([], '/dashboard')).toBeNull();
    });
  });
});
