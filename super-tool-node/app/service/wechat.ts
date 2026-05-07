import BaseService from './base';

/**
 * 微信登录服务
 * 策略模式: 根据 platform 自动路由到对应的微信登录流程
 *   - miniprogram → jscode2session
 *   - h5          → 公众号 OAuth2
 *   - app/ios/android → 开放平台 OAuth2
 */

interface WechatSessionResult {
  openId: string;
  unionId?: string;
  sessionKey?: string;
  accessToken?: string;
  refreshToken?: string;
  nickname?: string;
  avatar?: string;
  rawData?: object;
}

interface WechatConfig {
  appId: string;
  secret: string;
}

export default class WechatService extends BaseService {

  /**
   * 统一微信登录入口 — 策略分发
   */
  async login(platform: string, code: string, userInfo?: any): Promise<WechatSessionResult> {
    switch (platform) {
      case 'miniprogram':
        return this.miniprogramLogin(code, userInfo);
      case 'h5':
        return this.h5Login(code);
      case 'app':
      case 'ios':
      case 'android':
        return this.appLogin(code);
      default:
        this.ctx.throw(400, `不支持的微信登录平台: ${platform}`);
    }
  }

  /**
   * 获取 H5 微信授权 URL（前端跳转用）
   */
  getH5AuthUrl(redirectUri: string, state?: string): string {
    const config = this.getConfig('h5');
    const encodedUri = encodeURIComponent(redirectUri);
    const stateParam = state || Math.random().toString(36).slice(2);
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${config.appId}&redirect_uri=${encodedUri}&response_type=code&scope=snsapi_userinfo&state=${stateParam}#wechat_redirect`;
  }

  // ===== 私有策略实现 =====

  /**
   * 小程序登录: code → jscode2session → openid/session_key
   */
  private async miniprogramLogin(code: string, userInfo?: any): Promise<WechatSessionResult> {
    const config = this.getConfig('mp');
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.appId}&secret=${config.secret}&js_code=${code}&grant_type=authorization_code`;

    const response = await this.httpGet(url);

    if (response.errcode) {
      this.ctx.logger.error('[WechatService] jscode2session failed:', response);
      this.ctx.throw(400, `微信登录失败: ${response.errmsg || '授权码无效'}`);
    }

    return {
      openId: response.openid,
      unionId: response.unionid,
      sessionKey: response.session_key,
      nickname: userInfo?.nickName,
      avatar: userInfo?.avatarUrl,
      rawData: userInfo,
    };
  }

  /**
   * H5 公众号登录: code → access_token → userinfo
   */
  private async h5Login(code: string): Promise<WechatSessionResult> {
    const config = this.getConfig('h5');

    // Step 1: code 换 access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.appId}&secret=${config.secret}&code=${code}&grant_type=authorization_code`;
    const tokenRes = await this.httpGet(tokenUrl);

    if (tokenRes.errcode) {
      this.ctx.logger.error('[WechatService] h5 token exchange failed:', tokenRes);
      this.ctx.throw(400, `微信授权失败: ${tokenRes.errmsg || '授权码无效'}`);
    }

    // Step 2: 获取用户信息
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenRes.access_token}&openid=${tokenRes.openid}&lang=zh_CN`;
    const userInfoRes = await this.httpGet(userInfoUrl);

    if (userInfoRes.errcode) {
      this.ctx.logger.error('[WechatService] h5 userinfo failed:', userInfoRes);
      // 即使拿不到用户信息也不阻塞登录
    }

    return {
      openId: tokenRes.openid,
      unionId: tokenRes.unionid,
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      nickname: userInfoRes?.nickname,
      avatar: userInfoRes?.headimgurl,
      rawData: userInfoRes,
    };
  }

  /**
   * APP 开放平台登录: code → access_token → userinfo
   */
  private async appLogin(code: string): Promise<WechatSessionResult> {
    const config = this.getConfig('open');

    // Step 1: code 换 access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.appId}&secret=${config.secret}&code=${code}&grant_type=authorization_code`;
    const tokenRes = await this.httpGet(tokenUrl);

    if (tokenRes.errcode) {
      this.ctx.logger.error('[WechatService] app token exchange failed:', tokenRes);
      this.ctx.throw(400, `微信授权失败: ${tokenRes.errmsg || '授权码无效'}`);
    }

    // Step 2: 获取用户信息
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenRes.access_token}&openid=${tokenRes.openid}&lang=zh_CN`;
    const userInfoRes = await this.httpGet(userInfoUrl);

    return {
      openId: tokenRes.openid,
      unionId: tokenRes.unionid,
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      nickname: userInfoRes?.nickname,
      avatar: userInfoRes?.headimgurl,
      rawData: userInfoRes,
    };
  }

  // ===== 工具方法 =====

  /**
   * 获取微信配置（从 config 或数据库 system_configs 读取）
   */
  private getConfig(type: 'mp' | 'h5' | 'open'): WechatConfig {
    const wechatConfig = (this.app.config as any).wechat || {};
    const configMap: Record<string, WechatConfig> = {
      mp: { appId: wechatConfig.mpAppId || '', secret: wechatConfig.mpSecret || '' },
      h5: { appId: wechatConfig.h5AppId || '', secret: wechatConfig.h5Secret || '' },
      open: { appId: wechatConfig.openAppId || '', secret: wechatConfig.openSecret || '' },
    };

    const config = configMap[type];
    if (!config?.appId || !config?.secret) {
      this.ctx.throw(500, `微信${type}平台配置未设置，请在系统设置中配置 appId 和 secret`);
    }
    return config;
  }

  /**
   * HTTP GET 请求封装
   */
  private async httpGet(url: string): Promise<any> {
    try {
      const response = await this.ctx.curl(url, {
        method: 'GET',
        dataType: 'json',
        timeout: 10000,
      });
      return response.data;
    } catch (err: any) {
      this.ctx.logger.error('[WechatService] HTTP request failed:', err.message);
      this.ctx.throw(500, '微信接口请求失败，请稍后重试');
    }
  }
}
