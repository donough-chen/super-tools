/**
 * 通用「功能开发中」路由拦截页
 *
 * 用于二级/三级页面尚未开发完成时的占位提示。
 * 设计要点：
 * - 零第三方依赖，自带 CSS，适用于 PC 和移动端
 * - 响应式布局：手机窄屏时字号和间距自动收敛
 * - 返回按钮默认回退上一页，可通过 onBack 自定义
 * - 可选 title/description/showHome 等属性，满足多场景
 */
import React from 'react';
import { navigateBack, navigateTo } from '../../utils/navigator';
import './index.css';

export interface UnderConstructionProps {
  /** 主标题，默认「功能开发中」 */
  title?: string;
  /** 副标题说明文字 */
  description?: string;
  /** 返回按钮文字，默认「返回上一页」 */
  backText?: string;
  /** 自定义返回逻辑，默认 navigateBack() */
  onBack?: () => void;
  /** 是否显示「返回首页」按钮 */
  showHome?: boolean;
  /** 首页路径，默认 '/' */
  homePath?: string;
  /** 首页按钮文字 */
  homeText?: string;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({
  title = '功能开发中',
  description = '该功能正在紧张开发中，敬请期待～',
  backText = '返回上一页',
  onBack,
  showHome = false,
  homePath = '/',
  homeText = '返回首页',
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else navigateBack();
  };

  const handleHome = () => {
    navigateTo(homePath);
  };

  return (
    <div className="st-under-construction">
      <div className="st-under-construction__card">
        {/* 插画 */}
        <div className="st-under-construction__illustration" aria-hidden="true">
          <div className="st-under-construction__gear st-under-construction__gear--lg" />
          <div className="st-under-construction__gear st-under-construction__gear--sm" />
          <div className="st-under-construction__cone" />
        </div>

        {/* 文案 */}
        <h2 className="st-under-construction__title">{title}</h2>
        <p className="st-under-construction__desc">{description}</p>

        {/* 操作按钮 */}
        <div className="st-under-construction__actions">
          <button
            type="button"
            className="st-under-construction__btn st-under-construction__btn--primary"
            onClick={handleBack}
          >
            {backText}
          </button>
          {showHome && (
            <button
              type="button"
              className="st-under-construction__btn"
              onClick={handleHome}
            >
              {homeText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnderConstruction;
