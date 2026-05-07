// 主题状态管理（Zustand + immer）
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ThemeType = 'light' | 'dark';
export type AccentColor = 'indigo' | 'blue' | 'purple' | 'green';

interface ThemeState {
  theme: ThemeType;
  accentColor: AccentColor;
}

interface ThemeActions {
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
  initTheme: () => void;
  setAccentColor: (color: AccentColor) => void;
}

// 从 localStorage 或系统偏好读取初始主题
const getInitialTheme = (): ThemeType => {
  try {
    const saved = localStorage.getItem('theme') as ThemeType;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

// 从 localStorage 读取初始主题色
const getInitialAccentColor = (): AccentColor => {
  try {
    const saved = localStorage.getItem('accentColor') as AccentColor;
    if (['indigo', 'blue', 'purple', 'green'].includes(saved)) return saved;
  } catch {}
  return 'indigo';
};

// 应用主题到 DOM
const applyTheme = (theme: ThemeType) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

// 应用主题色到 DOM
const applyAccentColor = (color: AccentColor) => {
  document.documentElement.setAttribute('data-accent', color);
  localStorage.setItem('accentColor', color);
};

export const useThemeStore = create<ThemeState & ThemeActions>()(
  immer((set, get) => ({
    theme: getInitialTheme(),
    accentColor: getInitialAccentColor(),

    setTheme: (theme: ThemeType) => {
      applyTheme(theme);
      set((state) => {
        state.theme = theme;
      });
    },

    toggleTheme: () => {
      const nextTheme: ThemeType = get().theme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
      set((state) => {
        state.theme = nextTheme;
      });
    },

    initTheme: () => {
      const theme = getInitialTheme();
      const accentColor = getInitialAccentColor();
      applyTheme(theme);
      applyAccentColor(accentColor);
      set((state) => {
        state.theme = theme;
        state.accentColor = accentColor;
      });
    },

    setAccentColor: (color: AccentColor) => {
      applyAccentColor(color);
      set((state) => {
        state.accentColor = color;
      });
    },
  })),
);
