import type { Effect, Reducer } from 'umi';
import { fetchMenusApi, fetchPermissionsApi } from '@/services/menu';
import {
  getCachedMenus, setCachedMenus,
  getCachedPermissions, setCachedPermissions,
  clearRbacCache,
} from '@/utils/menuCache';

/** 全局状态（包含 RBAC 菜单/权限） */
export interface GlobalModelState {
  collapsed: boolean;
  menus: MenuNode[];
  permissions: string[];
  rbacReady: boolean;
}

export interface GlobalModelType {
  namespace: 'global';
  state: GlobalModelState;
  effects: {
    initRBAC: Effect;
    refreshRBAC: Effect;
  };
  reducers: {
    setCollapsed: Reducer<GlobalModelState>;
    setRBAC: Reducer<GlobalModelState>;
    setRBACReady: Reducer<GlobalModelState>;
    resetRBAC: Reducer<GlobalModelState>;
  };
}

const GlobalModel: GlobalModelType = {
  namespace: 'global',

  state: {
    collapsed: false,
    menus: [],
    permissions: [],
    rbacReady: false,
  },

  effects: {
    /**
     * 初始化 RBAC：优先读 sessionStorage，未命中则串行拉两个接口
     * 串行而非并行，确保一个失败不阻塞另一个
     */
    *initRBAC(_, { call, put }) {
      const cMenus = getCachedMenus();
      const cPerms = getCachedPermissions();
      if (cMenus && cPerms) {
        yield put({ type: 'setRBAC', payload: { menus: cMenus, permissions: cPerms } });
        return;
      }
      let menus: MenuNode[] = [];
      let permissions: string[] = [];
      try {
        const r: ApiResponse<MenuNode[]> = yield call(fetchMenusApi);
        menus = r?.data || [];
      } catch { /* swallow */ }
      try {
        const r: ApiResponse<string[]> = yield call(fetchPermissionsApi);
        permissions = r?.data || [];
      } catch { /* swallow */ }
      setCachedMenus(menus);
      setCachedPermissions(permissions);
      yield put({ type: 'setRBAC', payload: { menus, permissions } });
    },

    /**
     * 强制刷新 RBAC：清缓存 + 重新初始化
     */
    *refreshRBAC(_, { put }) {
      clearRbacCache();
      yield put({ type: 'setRBACReady', payload: false });
      yield put({ type: 'initRBAC' });
    },
  },

  reducers: {
    setCollapsed(state, { payload }) {
      state.collapsed = payload;
    },
    setRBAC(state, { payload }) {
      state.menus = payload.menus;
      state.permissions = payload.permissions;
      state.rbacReady = true;
    },
    setRBACReady(state, { payload }) {
      state.rbacReady = payload;
    },
    resetRBAC(state) {
      state.menus = [];
      state.permissions = [];
      state.rbacReady = false;
    },
  },
};

export default GlobalModel;
