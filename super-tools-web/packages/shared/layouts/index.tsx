import React from 'react';
import ReactDOM from 'react-dom';
import { IRouteComponentProps } from 'umi';
import appsdk from '../appsdk';
import { config, utils, openPages } from '../utils';

export default function Layout({ children, location, route }: IRouteComponentProps) {
  const newPathName = window.location.pathname.replace(/\/$/, '');

  // 端外访问引导下载（非 App、非小程序、非分享页、非白名单页面）
  if (
    !appsdk.isApp &&
    !appsdk.isMiniApp &&
    !(location.query.share || utils.getUrlParam('share')) &&
    !openPages.has(newPathName) &&
    process.env.NODE_ENV !== 'development'
  ) {
    window.location.href = `${window.location.protocol}//your-app-download-page.com`;
    return null;
  }

  // 设置页面标题
  const routes = route.routes || [];
  let curRoute = routes.find(
    r => r.path === location.pathname || `${r.path}/` === location.pathname,
  );
  if (!curRoute && routes.length > 0) {
    curRoute = routes[0].routes?.find(
      r => r.path === location.pathname || `${r.path}/` === location.pathname,
    );
  }

  const { vconsole, costomTitle } = utils.formatUrl();
  const title = (costomTitle ?? curRoute?.title) ?? 'Super Tools';
  const times = curRoute?.times ?? 20;
  appsdk.ensure('setPageTitle', false, times)(title);

  // 开发环境注入调试工具
  if (config.env === 'dev' && vconsole) {
    if (vconsole === '1' || vconsole === '3') {
      import('vconsole').then(module => {
        const VConsole = module.default;
        new VConsole();
      });
    }
    if (vconsole === '2' || vconsole === '3') {
      const websdk = document.createElement('div');
      websdk.id = 'websdk-root';
      document.body.appendChild(websdk);
      // 可在此处动态引入自定义调试面板
    }
  }

  return <>{children}</>;
}
