/**
 * UmiJS 约定式 404 兜底页
 *
 * 触发场景：
 * 1. 用户直接访问一个不存在的 URL
 * 2. 工具/菜单点击跳转时，目标路径不在 KNOWN_ROUTES 白名单内，由 safeNavigate 重定向到 /404
 *
 * UI 复用 shared 包中的 UnderConstruction 组件：
 * - 提供"返回上一页"和"返回首页"两个动作
 * - 自动适配 PC 与移动端
 */
import React from 'react';
import UnderConstruction from '@/components/UnderConstruction';

const NotFoundPage: React.FC = () => {
  return (
    <UnderConstruction
      title="功能开发中"
      description="你访问的页面不存在或正在紧张开发中，敬请期待～"
      backText="返回上一页"
      showHome
      homePath="/"
      homeText="返回首页"
    />
  );
};

export default NotFoundPage;
