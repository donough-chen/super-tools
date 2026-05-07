/**
 * 环境配置
 * 根据 hostname 和 pathname 自动判断当前环境
 */
const config = {
  /** 当前环境：dev | preview | prod */
  env: /test|localhost|127\.0\.0\.1/.test(window.location.hostname)
    ? 'dev'
    : /^\/fepreview\//.test(window.location.pathname)
    ? 'preview'
    : 'prod',

  /** 当前系统：ios | android | other */
  system: /iphone|ipad|ipod|mac/i.test(navigator.userAgent)
    ? 'ios'
    : /android/i.test(navigator.userAgent)
    ? 'android'
    : 'other',
};

export default config;
