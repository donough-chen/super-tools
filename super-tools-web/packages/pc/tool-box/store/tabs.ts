// 窗口标签状态管理（Zustand + immer）
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface TabItem {
  key: string;        // 路由路径，唯一标识
  title: string;      // 标签标题
  path: string;       // 路由路径
  closable?: boolean; // 是否可关闭（首页不可关闭）
}

interface TabsState {
  tabs: TabItem[];
  activeKey: string;
}

interface TabsActions {
  addTab: (tab: TabItem) => void;
  removeTab: (key: string) => void;
  setActiveKey: (key: string) => void;
  closeOthers: (key: string) => void;
  closeAll: () => void;
}

export const MAX_TABS = 10;

export const useTabsStore = create<TabsState & TabsActions>()(
  immer((set, get) => ({
    tabs: [{ key: '/', title: '首页', path: '/', closable: false }],
    activeKey: '/',

    addTab: (tab: TabItem) => {
      set((state) => {
        const exists = state.tabs.find((t) => t.key === tab.key);
        if (exists) {
          state.activeKey = tab.key;
        } else {
          state.tabs.push(tab);
          state.activeKey = tab.key;
        }
      });
    },

    removeTab: (key: string) => {
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.key === key);
        if (idx === -1) return;
        state.tabs.splice(idx, 1);
        // 如果关闭的是当前激活标签，激活相邻标签
        if (state.activeKey === key) {
          state.activeKey = state.tabs[Math.max(0, idx - 1)]?.key || '/';
        }
      });
    },

    setActiveKey: (key: string) => {
      set((state) => {
        state.activeKey = key;
      });
    },

    closeOthers: (key: string) => {
      set((state) => {
        state.tabs = state.tabs.filter((t) => !t.closable || t.key === key);
        state.activeKey = key;
      });
    },

    closeAll: () => {
      set((state) => {
        state.tabs = state.tabs.filter((t) => !t.closable);
        state.activeKey = '/';
      });
    },
  })),
);
