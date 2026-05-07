import React from 'react';
import { Result, Button } from 'antd';
import { history } from 'umi';

/** 403 无权限页 */
const Forbidden: React.FC = () => (
  <Result
    status="403"
    title="403"
    subTitle="抱歉，您没有权限访问此页面。"
    extra={
      <Button type="primary" onClick={() => history.push('/')}>
        返回首页
      </Button>
    }
  />
);

export default Forbidden;
