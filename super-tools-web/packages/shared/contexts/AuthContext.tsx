import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/** 用户登录态信息 */
export interface UserInfo {
  userId: string;
  uin: string;
  token: string;
  nickname?: string;
  avatar?: string;
  openid?: string;
}

interface AuthContextValue {
  userInfo: UserInfo | null;
  isLoggedIn: boolean;
  setUserInfo: (info: UserInfo | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  userInfo: null,
  isLoggedIn: false,
  setUserInfo: () => {},
  logout: () => {},
});

/**
 * 登录态 Context Provider
 * 包裹在根组件外层，提供全局登录态管理
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userInfo, setUserInfoState] = useState<UserInfo | null>(null);

  const setUserInfo = useCallback((info: UserInfo | null) => {
    setUserInfoState(info);
  }, []);

  const logout = useCallback(() => {
    setUserInfoState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        userInfo,
        isLoggedIn: Boolean(userInfo?.userId),
        setUserInfo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 使用登录态 Hook
 */
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
