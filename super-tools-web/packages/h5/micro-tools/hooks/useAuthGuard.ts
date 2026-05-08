import { useEffect } from 'react';
import { navigateReplace } from '@/utils/navigator';
import { PROTECTED_PATHS } from '../constants/oauth';

/**
 * 路由守卫 Hook
 * 在 layouts 中调用，未登录访问 PROTECTED_PATHS 时自动跳 /login?redirect=<current>
 *
 * @param pathname 当前路径
 * @param authChecked 鉴权初始化是否完成（initAuth 之前不应做跳转）
 * @param isLoggedIn 当前登录状态
 *
 * 设计说明：把 isLoggedIn 作为参数传入而非从 store 直接读，
 * 避免 hook 内部订阅造成 layout 多余 re-render。
 */
export const useAuthGuard = (
  pathname: string,
  authChecked: boolean,
  isLoggedIn: boolean,
) => {
  useEffect(() => {
    if (!authChecked) return;
    const needAuth = PROTECTED_PATHS.some(p =>
      pathname === p || pathname.startsWith(`${p}/`),
    );
    if (needAuth && !isLoggedIn) {
      navigateReplace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authChecked, isLoggedIn, pathname]);
};
