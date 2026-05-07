/**
 * Service 层兼容入口
 * 实际实现已模块化拆分到 ./service/ 目录，本文件仅做 re-export
 * 保留是为了不破坏现有 import 路径（store/user.ts 等仍引用旧函数名）
 *
 * 新代码请直接 import from './service' 或 './service/auth' 等子模块
 */

// 1) 重新导出新模块的全部命名导出（含 getMemberInfo、login*、register*、user/device/member 等）
export * from './service';

// 2) 旧别名兼容（旧代码用的是 authLogin/authRegister 等名字）
import {
  loginByPassword,
  registerByEmail,
  refreshTokenApi,
  sendCode,
  logoutApi,
} from './service/auth';
import { getProfile } from './service/user';

/** @deprecated 改用 service/auth.loginByPassword */
export const authLogin = (username: string, password: string) =>
  loginByPassword({ username, password });

/** @deprecated 改用 service/auth.registerByEmail */
export const authRegister = registerByEmail;

/** @deprecated 改用 service/auth.refreshTokenApi */
export const authRefresh = refreshTokenApi;

/** @deprecated 改用 service/auth.sendCode */
export const authSendCode = (target: string, type: string) =>
  sendCode(target, type as 'login' | 'register' | 'reset' | 'bind');

/**
 * @deprecated 改用 service/auth.logoutApi（token 由拦截器自动注入，参数已不再需要）
 * 保留 _token 形参仅为兼容旧调用
 */
export const authLogout = (_token?: string) => logoutApi();

/**
 * @deprecated 改用 service/user.getProfile（token 由拦截器自动注入）
 * 保留 _token 形参仅为兼容旧调用
 */
export const getUserProfile = (_token?: string) => getProfile();

// 3) 旧类型别名导出兼容
// 注：使用 `export { ... }`（非 type-only）以兼容旧代码使用 value 形式 import
//    （store/user.ts 中 `import { LoginResponseData } from '../service'` 不带 type 关键字）
//    TS 编译时 interface 的 export 仅作类型声明导出，不会产生运行时副作用
export {
  UserInfo as UserProfileData,
  LoginResponse as LoginResponseData,
  RegisterResponse as RegisterResponseData,
} from './types/auth';

// 注：getMemberInfo 已通过 `export * from './service'` 自动导出，此处不重复
