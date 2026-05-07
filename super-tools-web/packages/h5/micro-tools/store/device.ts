/**
 * 设备 / 会话 Store
 * - 设备：注册当前设备 / 设备列表 / 移除 / 推送开关
 * - 会话：活跃会话列表 / 踢下线
 *
 * 当前会话 ID 由 useUserStore.currentSessionId 维护（登录时写入），
 * 本 Store 只负责操作列表，不持久化设备 ID（设备 ID 由 useDeviceInfo Hook 生成并存 localStorage）
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as deviceService from '../service/device';
import { mapErrorCode } from '../utils/errorMap';
import type {
  DeviceInfo, SessionInfo, RegisterDeviceDTO, ActionResult,
} from '../types/auth';

interface DeviceState {
  devices: DeviceInfo[];
  sessions: SessionInfo[];
  loading: boolean;
}

interface DeviceActions {
  /** 上报当前设备（layouts 启动时调用，幂等 upsert） */
  registerCurrentDevice: (dto: RegisterDeviceDTO) => Promise<void>;
  /** 拉取当前用户的设备列表 */
  fetchDevices: () => Promise<void>;
  /** 拉取当前用户的活跃会话列表 */
  fetchSessions: () => Promise<void>;
  /** 移除指定设备（软删） */
  removeDevice: (deviceId: string) => Promise<ActionResult>;
  /** 切换设备推送开关 */
  updateDevicePush: (deviceId: string, pushEnabled: boolean) => Promise<ActionResult>;
  /** 踢下线指定会话 */
  kickSession: (sessionId: string) => Promise<ActionResult>;
  reset: () => void;
}

const initialState: DeviceState = { devices: [], sessions: [], loading: false };

const wrapErr = (e: any, fallback: string) =>
  mapErrorCode(
    e?.data?.code || e?.response?.status,
    e?.data?.message || fallback,
  );

export const useDeviceStore = create<DeviceState & DeviceActions>()(
  immer((set) => ({
    ...initialState,

    registerCurrentDevice: async (dto) => {
      try {
        await deviceService.registerDevice(dto);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useDeviceStore] registerCurrentDevice failed:', e);
      }
    },

    fetchDevices: async () => {
      set(s => { s.loading = true; });
      try {
        const res: any = await deviceService.listDevices();
        if (res?.code === 200) {
          set(s => { s.devices = res.data || []; });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useDeviceStore] fetchDevices failed:', e);
      } finally {
        set(s => { s.loading = false; });
      }
    },

    fetchSessions: async () => {
      set(s => { s.loading = true; });
      try {
        const res: any = await deviceService.getSessions();
        if (res?.code === 200) {
          set(s => { s.sessions = res.data || []; });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useDeviceStore] fetchSessions failed:', e);
      } finally {
        set(s => { s.loading = false; });
      }
    },

    removeDevice: async (deviceId) => {
      try {
        const res: any = await deviceService.removeDevice(deviceId);
        if (res?.code === 200) {
          set(s => {
            s.devices = s.devices.filter(d => d.deviceId !== deviceId);
          });
          return { success: true, message: '设备已移除' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '移除失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapErr(e, '移除失败') };
      }
    },

    updateDevicePush: async (deviceId, pushEnabled) => {
      try {
        const res: any = await deviceService.updateDevicePush(deviceId, pushEnabled);
        if (res?.code === 200) {
          set(s => {
            const d = s.devices.find(x => x.deviceId === deviceId);
            if (d) d.pushEnabled = pushEnabled ? 1 : 0;
          });
          return { success: true, message: '推送设置已更新' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '更新失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapErr(e, '更新失败') };
      }
    },

    kickSession: async (sessionId) => {
      try {
        const res: any = await deviceService.kickSession(sessionId);
        if (res?.code === 200) {
          set(s => {
            s.sessions = s.sessions.filter(x => x.sessionId !== sessionId);
          });
          return { success: true, message: '会话已终止' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '操作失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapErr(e, '操作失败') };
      }
    },

    reset: () => set(() => ({ ...initialState })),
  })),
);
