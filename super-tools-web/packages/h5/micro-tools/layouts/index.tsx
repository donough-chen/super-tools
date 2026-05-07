/**
 * micro-tools Layout 入口
 *
 * 职责：
 * 1. 副作用导入 utils/authRequest 触发请求拦截器注册（Bearer Token 注入 + 401 自动刷新）
 * 2. 启动时调用 useUserStore.initAuth() 恢复登录态（从 localStorage 读 token + 拉用户资料）
 * 3. 调用 useAuthGuard 守护强鉴权路由（未登录访问 /profile|/settings|/favorites|/member 时跳 /login）
 * 4. 登录后异步上报当前 H5 设备（POST /api/users/devices upsert）
 * 5. 在共享 Layout 基础上集成 KeepAlive 页面缓存
 *
 * 注意：utils/authRequest 必须在最顶部 import（在所有 service 调用之前），
 *      以确保拦截器在第一个请求发起前已注册到 customRequest 实例上
 */
import '../utils/authRequest'; // ← 副作用导入：注册请求拦截器（必须最先）

import React, { useEffect, useRef, useState } from 'react';
import { default as SharedLayout } from '../../../shared/layouts';
import CacheRoute from '../components/KeepAlive/CacheRoute';
import { useUserStore, useDeviceStore } from '../store';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useDeviceInfo } from '../hooks/useDeviceInfo';

export default ({ children, location, ...restProps }: any) => {
  const initAuth = useUserStore(state => state.initAuth);
  const isLoggedIn = useUserStore(state => state.isLoggedIn);
  const registerCurrentDevice = useDeviceStore(state => state.registerCurrentDevice);
  const deviceInfo = useDeviceInfo();

  const [authChecked, setAuthChecked] = useState(false);
  const deviceRegisteredRef = useRef(false);

  // 启动恢复登录态
  useEffect(() => {
    initAuth().finally(() => setAuthChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登录后注册当前设备（每个登录态仅注册一次，避免重复 POST）
  useEffect(() => {
    if (!authChecked || !isLoggedIn) return;
    if (deviceRegisteredRef.current) return;
    deviceRegisteredRef.current = true;
    registerCurrentDevice({
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
      deviceName: deviceInfo.deviceName,
      osVersion: deviceInfo.osVersion,
      appVersion: deviceInfo.appVersion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isLoggedIn]);

  // 登出后允许下次登录再次注册
  useEffect(() => {
    if (authChecked && !isLoggedIn) {
      deviceRegisteredRef.current = false;
    }
  }, [authChecked, isLoggedIn]);

  // 路由守卫
  useAuthGuard(location.pathname, authChecked, isLoggedIn);

  return (
    <SharedLayout location={location} {...restProps}>
      <CacheRoute pathname={location.pathname}>
        {children}
      </CacheRoute>
    </SharedLayout>
  );
};
