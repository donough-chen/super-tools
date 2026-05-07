import qs from 'query-string';
import request from './request';

/**
 * 获取 URL 参数（防 XSS）
 */
const getUrlParam = (name: string): string => {
  const params = qs.parse(window.location.search);
  const val = params[name.toLowerCase()];
  if (typeof val === 'string') return htmlEncode(val);
  return '';
};

/**
 * HTML 特殊字符转义，防止 XSS 攻击
 */
const htmlEncode = (str: string): string => {
  if (str === null || str === undefined) return '';
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return String(str).replace(/[&<>"'/]/g, match => escapeMap[match]);
};

/**
 * 解析 URL 参数为对象
 */
const formatUrl = (urlSearch = ''): Record<string, string> => {
  const search = urlSearch || window.location.search;
  const result: Record<string, string> = {};
  if (search.indexOf('?') !== -1) {
    const str = search.substr(1);
    str.split('&').forEach(item => {
      const [key, val] = item.split('=');
      if (key) result[key] = decodeURIComponent(val || '');
    });
  }
  return result;
};

/**
 * 将参数对象拼接为 query string
 */
const joinParams = (params: Record<string, any>): string => {
  if (!params || typeof params !== 'object') return '';
  return '?' + Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
};

/**
 * 防抖函数
 */
const debounce = <T extends (...args: any[]) => any>(fn: T, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
};

/**
 * 节流函数
 */
const throttle = <T extends (...args: any[]) => any>(fn: T, wait: number) => {
  let lastTime = 0;
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
};

/**
 * 安全 JSON 解析
 */
const safeJsonParse = <T = any>(str: string, fallback?: T): T | null => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback ?? null;
  }
};

/**
 * 日期格式化
 * @param fmt 格式字符串，如 'yyyy-MM-dd hh:mm:ss'
 * @param date 日期对象，默认当前时间
 */
const dateFormat = (fmt = 'yyyy-MM-dd', date = new Date()): string => {
  const o: Record<string, number> = {
    'M+': date.getMonth() + 1,
    'd+': date.getDate(),
    'h+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds(),
    'q+': Math.floor((date.getMonth() + 3) / 3),
    S: date.getMilliseconds(),
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, String(date.getFullYear()).substr(4 - RegExp.$1.length));
  }
  for (const k in o) {
    if (new RegExp(`(${k})`).test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? String(o[k]) : `00${o[k]}`.substr(String(o[k]).length),
      );
    }
  }
  return fmt;
};

/**
 * 检测是否为微信环境
 */
const isWx = (): boolean => {
  return /MicroMessenger/i.test(navigator.userAgent);
};

/**
 * 检测是否支持 WebP
 */
const isSupportWebp = (): boolean => {
  try {
    return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
};

/**
 * 数据上报（埋点）
 */
const reportEvent = (
  mid: number,
  eid: number,
  target: string,
  game: string,
  uin: string,
  userInfo: Record<string, any> = {},
  szext1 = '',
  szext2 = '',
  szext3 = '',
  szext4 = '',
  cb: () => void = () => {},
) => {
  const curl = window.location.href;
  const surl = target ? curl : document.referrer;
  const durl = target || curl;

  const formData = new FormData();
  const data: Record<string, any> = {
    mid, eid, surl, durl,
    qq: uin || '',
    openid: userInfo.openid || '',
    game: game || 'super-tools',
    bd: userInfo.bd || 0,
    qid: 3,
    aid: userInfo.userId || 0,
    from: 'mobile',
    ref: '',
    encodeOpenId: userInfo.encodeOpenId === '1' ? 1 : 0,
    encodeQQ: userInfo.encodeQQ === '1' ? 1 : 0,
    szext1, szext2, szext3, szext4,
  };

  for (const [k, v] of Object.entries(data)) {
    if (v !== '') formData.append(k, String(v));
  }

  request.post('/login/analysis', {
    data: formData,
    requestType: 'form',
    noToken: true,
  } as any).then(() => cb());
};

const utils = {
  getUrlParam,
  htmlEncode,
  formatUrl,
  joinParams,
  debounce,
  throttle,
  safeJsonParse,
  dateFormat,
  isWx,
  isSupportWebp,
  reportEvent,
};

export default utils;
