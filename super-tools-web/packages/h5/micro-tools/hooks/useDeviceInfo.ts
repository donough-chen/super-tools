import { useMemo } from 'react';
import { DEVICE_ID_STORAGE_KEY, H5_DEVICE_TYPE } from '../constants/oauth';
import type { RegisterDeviceDTO } from '../types/auth';

/**
 * 生成稳定的 H5 设备指纹
 * 策略：localStorage 缓存 → 不存在则基于 navigator + screen 生成
 */
const generateDeviceId = (): string => {
  try {
    const cached = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (cached) return cached;
  } catch { /* 隐私模式 localStorage 不可用 */ }

  // 基于稳定特征生成（不使用 canvas 指纹避免阻塞）
  const features = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    new Date().getTimezoneOffset().toString(),
  ].join('|');

  // 简单 hash（djb2 算法），输出 8 位字母数字
  let hash = 5381;
  for (let i = 0; i < features.length; i++) {
    hash = ((hash << 5) + hash) + features.charCodeAt(i);
    hash = hash & 0xffffffff; // 保持 32 位
  }
  const id = `h5-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;

  try { localStorage.setItem(DEVICE_ID_STORAGE_KEY, id); } catch { /* 静默失败 */ }
  return id;
};

/**
 * 解析浏览器名称与版本
 */
const parseBrowser = (): string => {
  const ua = navigator.userAgent;
  const match =
    ua.match(/(Edg|Chrome|Firefox|Safari|OPR)\/([\d.]+)/) ||
    ua.match(/(Trident)\/([\d.]+)/);
  if (!match) return 'Unknown Browser';
  const name = match[1] === 'Edg' ? 'Edge' : match[1] === 'OPR' ? 'Opera' : match[1] === 'Trident' ? 'IE' : match[1];
  const version = match[2].split('.')[0];
  return `${name} ${version}`;
};

/**
 * 解析操作系统
 */
const parseOS = (): string => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    const m = ua.match(/OS (\d+_\d+)/);
    return m ? `iOS ${m[1].replace('_', '.')}` : 'iOS';
  }
  if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return m ? `Android ${m[1]}` : 'Android';
  }
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
};

/**
 * 当前设备信息（用于 device upsert）
 * 调用方：layouts/index.tsx 启动时、/settings/devices 标记本机
 */
export const useDeviceInfo = (): RegisterDeviceDTO & { id: string } => {
  return useMemo(() => {
    const deviceId = generateDeviceId();
    return {
      id: deviceId, // 便于直接消费
      deviceId,
      deviceType: H5_DEVICE_TYPE,
      deviceName: parseBrowser(),
      osVersion: parseOS(),
      appVersion: '1.0.0', // micro-tools 当前 package.json version
    };
  }, []);
};
