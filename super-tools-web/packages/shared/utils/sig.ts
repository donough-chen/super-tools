import hmacSha1 from 'crypto-js/hmac-sha1';
import Base64 from 'crypto-js/enc-base64';

/**
 * 定制 URI 编码，与后台保持一致
 */
export const encodeUri = (uri: string): string => {
  return encodeURIComponent(uri)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/~/g, '%7E')
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27');
};

/**
 * 生成后台接口签名
 * @param method 请求方法（GET/POST 等）
 * @param urlPath 请求路径（不含 domain）
 * @param params 请求参数对象
 * @param privateKey 加密密钥
 */
export const createSig = (
  method: string,
  urlPath: string,
  params: Record<string, any>,
  privateKey: string,
): string => {
  if (!params.tghappid) {
    console.warn('[Sig] 缺少必要参数: tghappid');
  }
  const strParams = Object.keys(params)
    .sort()
    .filter(k => typeof params[k] !== 'undefined')
    .map(k => `${k}=${params[k]}`)
    .join('&');
  const str = `${method.toUpperCase()}&${encodeUri(urlPath)}&${encodeUri(strParams)}`;
  return Base64.stringify(hmacSha1(str, privateKey));
};
