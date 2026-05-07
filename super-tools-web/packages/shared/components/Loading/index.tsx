import React from 'react';
import './index.css';

interface LoadingProps {
  /** 是否全屏显示 */
  fullscreen?: boolean;
  /** 提示文字 */
  text?: string;
}

/**
 * 通用 Loading 组件
 * 用于路由切换和异步加载时的占位显示
 */
const Loading: React.FC<LoadingProps> = ({ fullscreen = true, text = '加载中...' }) => {
  return (
    <div className={`st-loading ${fullscreen ? 'st-loading--fullscreen' : ''}`}>
      <div className="st-loading__spinner">
        <div className="st-loading__dot"></div>
        <div className="st-loading__dot"></div>
        <div className="st-loading__dot"></div>
      </div>
      {text && <p className="st-loading__text">{text}</p>}
    </div>
  );
};

export default Loading;
