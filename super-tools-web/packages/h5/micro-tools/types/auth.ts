// === 用户基础信息（users 表） ===
export interface UserInfo {
  id: number;
  uuid: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  gender: 0 | 1 | 2;
  birthday: string | null;
  /** 1普通 2管理员 3超级管理员 — 与「会员」无关 */
  userType: 1 | 2 | 3;
  status: 0 | 1 | 2 | 3;
  isVerified: boolean;
  registerSource: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles?: Array<{ id: number; name: string; code: string }>;
}

// === 用户扩展资料（user_profiles 表） ===
export interface PrivacySettings {
  showPhone?: boolean;
  showEmail?: boolean;
  showOnlineStatus?: boolean;
}

export interface NotificationSettings {
  push?: boolean;
  sms?: boolean;
  email?: boolean;
}

export interface ProfileExtra {
  bio: string | null;
  signature: string | null;
  regionCode: string | null;
  language: string;
  timezone: string;
  referralCode: string | null;
  invitedBy: number | null;
  privacySettings: PrivacySettings | null;
  notificationSettings: NotificationSettings | null;
}

export interface FullProfile extends UserInfo {
  profile: ProfileExtra;
}

// === 登录响应 ===
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  isNewUser?: boolean;
  user?: UserInfo;
}

export interface RegisterResponse {
  id: number;
  uuid: string;
}

// === 绑定状态 ===
export interface BindStatus {
  hasPassword: boolean;
  phone: string | null;
  email: string | null;
  wechat: Array<{
    platform: 'wechat_miniprogram' | 'wechat_h5' | 'wechat_app';
    nickname: string | null;
    avatar: string | null;
    boundAt: string;
  }>;
}

// === 设备/会话 ===
export interface DeviceInfo {
  id: number;
  userId: number;
  deviceId: string;
  deviceName: string | null;
  deviceType: 'ios' | 'android' | 'web' | 'h5' | 'miniprogram';
  osVersion: string | null;
  appVersion: string | null;
  pushToken: string | null;
  pushEnabled: 0 | 1;
  lastActiveAt: string | null;
  status: 0 | 1;
}

export interface SessionInfo {
  sessionId: string;
  platform: string;
  ip: string | null;
  deviceName: string | null;
  location: string | null;
  createdAt: string;
}

// === 会员信息 ===
export interface MemberInfo {
  level: {
    id: number;
    name: string;
    code: string;
    level: number;
    icon: string | null;
    color: string | null;
  };
  growthValue: number;
  totalPoints: number;
  points: number;
  totalConsume: number;
  nextLevel: {
    name: string;
    code: string;
    upgradeGrowth: number;
    progress: number;
    remaining: number;
  } | null;
  paid: {
    isPaid: boolean;
    planName?: string;
    planCode?: string;
    startAt?: string;
    expireAt?: string | null;
    remainingDays?: number | null;
  };
}

// === Token 持久化 ===
export interface StoredTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sessionId: string;
}

// === DTO ===
export interface UpdateProfileDTO {
  nickname?: string;
  avatar?: string;
  gender?: 0 | 1 | 2;
  birthday?: string;
  bio?: string;
  signature?: string;
  regionCode?: string;
  language?: string;
  timezone?: string;
  privacySettings?: PrivacySettings;
  notificationSettings?: NotificationSettings;
}

export interface RegisterDeviceDTO {
  deviceId: string;
  deviceType: 'h5';
  deviceName?: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
}

// === 通用结果 ===
export interface ApiResult<T = any> {
  code: number;
  message?: string;
  data: T | null;
}

export interface ActionResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
}
