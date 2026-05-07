/**
 * 验证码倒计时全局状态
 * 持久化到 sessionStorage，刷新/切页保留剩余时间
 *
 * key 格式：`${target}:${type}`，例如 "13800138000:login"
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const STORAGE_KEY = 'super-tools-send-code-countdown';

interface SendCodeState {
  /** key → 倒计时结束时间戳（ms） */
  countdownMap: Record<string, number>;
}

interface SendCodeActions {
  /** 启动 N 秒倒计时（默认 60s） */
  startCountdown: (key: string, seconds?: number) => void;
  /** 获取剩余秒数（≤0 表示已结束） */
  getRemaining: (key: string) => number;
  /** 清空已结束的 key（避免 map 无限增长） */
  cleanup: () => void;
}

const loadFromStorage = (): Record<string, number> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, number>;
    // 过滤已过期项
    const now = Date.now();
    const valid: Record<string, number> = {};
    Object.entries(data).forEach(([k, v]) => { if (v > now) valid[k] = v; });
    return valid;
  } catch { return {}; }
};

const saveToStorage = (data: Record<string, number>) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* 静默失败 */ }
};

export const useSendCodeStore = create<SendCodeState & SendCodeActions>()(
  immer((set, get) => ({
    countdownMap: loadFromStorage(),

    startCountdown: (key, seconds = 60) => {
      const endsAt = Date.now() + seconds * 1000;
      set(state => {
        state.countdownMap[key] = endsAt;
        saveToStorage(state.countdownMap);
      });
    },

    getRemaining: (key) => {
      const endsAt = get().countdownMap[key];
      if (!endsAt) return 0;
      return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    },

    cleanup: () => {
      set(state => {
        const now = Date.now();
        Object.keys(state.countdownMap).forEach(k => {
          if (state.countdownMap[k] <= now) delete state.countdownMap[k];
        });
        saveToStorage(state.countdownMap);
      });
    },
  })),
);
