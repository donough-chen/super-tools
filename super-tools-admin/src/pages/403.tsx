import React from 'react';
import { Result, Button, Space, Tag } from 'antd';
import { useLocation, history, useDispatch } from 'umi';

/**
 * 403 无权限页
 * - 从 query string 读取 required 权限码，直观展示给用户便于联系管理员
 * - 提供「返回首页」和「重新登录」两个操作入口
 */
const Forbidden: React.FC = () => {
  const dispatch = useDispatch();
  const search = new URLSearchParams(useLocation().search);
  const required = search.get('required');

  return (
    <Result
      status="403"
      title="403"
      subTitle={
        required ? (
          <span>
            抱歉，您没有访问此页的权限。需要权限码：
            <Tag color="red" style={{ marginLeft: 4 }}>{required}</Tag>
          </span>
        ) : (
          '抱歉，您没有权限访问此页面。'
        )
      }
      extra={
        <Space>
          <Button type="primary" onClick={() => history.push('/home')}>
            返回首页
          </Button>
          <Button onClick={() => dispatch({ type: 'user/logout' })}>
            重新登录
          </Button>
        </Space>
      }
    />
  );
};

export default Forbidden;
