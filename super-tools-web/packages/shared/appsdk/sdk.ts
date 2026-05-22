/* eslint-disable no-underscore-dangle */
import qs from 'query-string';

export type TCallbackFunction = (...args: any[]) => any;

/** SessionStorage 缓存 key */
export const APP_SESSION_KEY = 'super-tools-app-session';

/**
 * AppSdk 单例类
 * 封装 JSBridge 环境检测、就绪检测、参数获取和页面导航
 */
class AppSdk {
  private _readinessCallbackPool: TCallbackFunction[] = [];
  private _instance: any;
  private _appParams: Record<string, any> = {};

  public isReady = false;
  public isApp: boolean;
  public isIOS: boolean;
  public isAndroid: boolean;
  public isMiniApp: boolean;

  constructor() {
    if (typeof this._instance !== 'undefined') {
      return this._instance;
    }
    this._instance = this;

    const ua = navigator.userAgent;
    this.isApp = ua.indexOf('CustomBridge') > -1;
    this.isIOS = /(iPhone|iPad|iPod|iTouch|iOS)/i.test(ua);
    this.isAndroid = /Android/i.test(ua);

    if (this.isApp) {
      // @ts-ignore
      window.onWebShow = () => this._checkReadyStatus();
      window.addEventListener('load', this._checkReadyStatus.bind(this), false);
      if (document.addEventListener) {
        document.addEventListener('CustomBridgeReady', this._checkReadyStatus.bind(this), false);
      }
    }

    // 初始化 isMiniApp
    const { isMini } = this.getAppParams();
    this.isMiniApp = Boolean(isMini);
  }

  private _checkReadyStatus() {
    if (this.isReady) return;
    // @ts-ignore
    if (typeof window.CustomBridge !== 'undefined') {
      this.isReady = true;
      while (this._readinessCallbackPool.length > 0) {
        const cb = this._readinessCallbackPool.pop();
        if (cb) cb();
      }
    }
  }

  private _sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 注册 App 就绪后的回调
   */
  ready(callback: TCallbackFunction) {
    this._readinessCallbackPool.push(callback);
  }

  /**
   * 确保 App 环境就绪后执行函数或调用 CustomBridge 接口
   * @param func 函数或 CustomBridge 接口名
   * @param autoCallback 是否自动 promisify callback 接口
   * @param times 最大重试次数
   */
  ensure(func: TCallbackFunction | string, autoCallback = false, times = 20) {
    let count = times;
    const ensureFunc = (...args: any[]) =>
      new Promise(async (resolve, reject) => {
        if (!this.isApp) {
          reject({ code: 1, message: 'Ensure Error: not in app.' });
          return;
        }

        if (this.isReady) {
          const cb = (...cbArgs: any[]) => {
            if (typeof func === 'string') {
              // @ts-ignore
              const gh = window.CustomBridge;
              if (typeof gh[func] === 'undefined') {
                reject({ code: 4, message: `Ensure Error: CustomBridge.${func} is undefined.` });
                return;
              }
              // @ts-ignore
              return typeof gh[func] === 'function' ? gh[func](...cbArgs) : gh[func];
            }
            return func(...cbArgs);
          };

          // iOS 使用 iFrame 通讯，需要延时防止连续调用覆盖
          if (this.isIOS) await this._sleep(4);

          if (autoCallback) {
            const result = cb(...args, resolve);
            if (typeof result !== 'undefined') resolve(result);
          } else {
            resolve(cb(...args));
          }
          return;
        }

        if (count < 1) {
          this.isApp = false;
          reject({ code: 2, message: 'Ensure Error: retries exceeded, maybe not in app.' });
          return;
        }

        count -= 1;
        this._checkReadyStatus();
        await this._sleep(200);
        resolve(ensureFunc(...args));
      });
    return ensureFunc;
  }

  /**
   * 获取 App 通过 URL 下发的参数，并缓存到 sessionStorage
   * @param keys 需要获取的 key 数组，缺省取所有参数
   */
  getAppParams(keys: string[] = []): Record<string, any> {
    const commonKeys = [
      'env', 'userId', 'nickname', 'avatar', 'token', 'accessToken', 'accType','cSystem', 'isMini',
    ];

    const params = this._appParams;
    const { query } = qs.parseUrl(window.location.href, { arrayFormat: 'bracket' });
    let needUpdate = false;

    commonKeys.forEach(key => {
      if (typeof query[key] !== 'undefined' && query[key] !== params[key]) {
        needUpdate = true;
        params[key] = query[key];
      }
    });

    if (JSON.stringify(params) === '{}' || needUpdate) {
      let session: any = {};
      try {
        session = JSON.parse(sessionStorage.getItem(APP_SESSION_KEY) || '{}');
      } catch {}

      if (!session.appParams && needUpdate) {
        Object.assign(params, query);
      } else {
        Object.assign(params, { ...session.appParams, ...params });
      }

      if (needUpdate) {
        sessionStorage.setItem(APP_SESSION_KEY, JSON.stringify({ appParams: params }));
      }
    }

    if (keys.length > 0) {
      return keys.reduce<Record<string, any>>((obj, key) => {
        obj[key] = params[key];
        return obj;
      }, {});
    }
    return params;
  }

  /** 打开新页面 */
  async openNewPage(url: string): Promise<boolean> {
    try {
      await this.ensure('openNewPage')(url);
      return true;
    } catch {
      window.location.href = url;
      return false;
    }
  }

  /** 打开新页面（带返回类型） */
  async openNewPageForBack(url: string, backType = 1): Promise<boolean> {
    try {
      if (this.isIOS) {
        await this.ensure('openNewPage')(url);
      } else {
        await this.ensure('openNewPage')(url, backType);
      }
      return true;
    } catch {
      window.location.href = url;
      return false;
    }
  }

  /** 打开新页面（带角色切换） */
  async openNewPageWithSwitch(url: string, back: any, role: any): Promise<boolean> {
    try {
      await this.ensure('openNewPageWithSwitch')(url, back, role);
      return true;
    } catch {
      return this.openNewPage(url);
    }
  }

  /** 打开新页面（扩展参数） */
  async openNewPageEx(paramstr: string): Promise<boolean> {
    try {
      await this.ensure('openNewPageEx')(paramstr);
      return true;
    } catch {
      const params = JSON.parse(paramstr);
      return this.openNewPage(params.url);
    }
  }

  /** 打开新页面（带标题） */
  async openNewPageWithTitle(url: string, backType: number, title: string): Promise<boolean> {
    const paramstr = JSON.stringify({ url, backType, title });
    try {
      await this.ensure('openNewPageEx')(paramstr);
      return true;
    } catch {
      window.location.href = url;
      return false;
    }
  }
}

const appsdk = new AppSdk();
export default appsdk;
