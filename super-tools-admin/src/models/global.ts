import type { ImmerReducer } from 'umi';

/** 全局状态 */
export interface GlobalModelState {
  collapsed: boolean;
  menuList: any[];
}

export interface GlobalModelType {
  namespace: 'global';
  state: GlobalModelState;
  reducers: {
    setCollapsed: ImmerReducer<GlobalModelState>;
    setMenuList: ImmerReducer<GlobalModelState>;
  };
}

const GlobalModel: GlobalModelType = {
  namespace: 'global',

  state: {
    collapsed: false,
    menuList: [],
  },

  reducers: {
    setCollapsed(state, { payload }) {
      state.collapsed = payload;
    },
    setMenuList(state, { payload }) {
      state.menuList = payload;
    },
  },
};

export default GlobalModel;
