import React from 'react';
// @ts-ignore
import { history } from 'umi';
import { Button } from 'antd';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const NotFound: React.FC = () => {
  return (
    <div className="not-found">
      {/* 404 数字 */}
      <div className="not-found__number">404</div>

      {/* 插图 */}
      <div className="not-found__illustration">
        <div className="not-found__planet" />
        <div className="not-found__orbit" />
        <div className="not-found__satellite" />
      </div>

      {/* 文字信息 */}
      <h2 className="not-found__title">页面不见了</h2>
      <p className="not-found__desc">
        您访问的页面可能已被移除、更名或暂时不可用
      </p>

      {/* 操作按钮 */}
      <div className="not-found__actions">
        <Button
          type="primary"
          size="large"
          icon={<HomeOutlined />}
          onClick={() => history.push('/')}
          className="not-found__btn-home"
        >
          返回首页
        </Button>
        <Button
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={() => history.go(-1)}
          className="not-found__btn-back"
        >
          返回上页
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
