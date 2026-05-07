import React, { useEffect } from 'react';
import { Link } from 'umi';
import { useHomeStore } from '../../store/home';
import { utils } from '@/utils';
import './index.less';

/**
 * 首页组件
 *
 * 架构说明：
 * - 状态管理：Zustand（替代 DVA）
 * - 数据获取：直接调用 store action（替代 dispatch）
 * - 类型安全：完整 TypeScript 支持
 */
const HomePage: React.FC = () => {
  const { data, loading, error, fetchData, initQuery } = useHomeStore();

  useEffect(() => {
    // 初始化 URL 参数
    const query = utils.formatUrl();
    initQuery(query);
    // 获取页面数据
    fetchData();
  }, []);

  if (loading) {
    return <div className="home-loading">加载中...</div>;
  }

  if (error) {
    return <div className="home-error">{error}</div>;
  }

  return (
    <div className="home-page">
      <h2 className="home-title">{`<%= parent %>-<%= projectName %>`}</h2>
      <p className="home-desc">欢迎使用 super-tools-web 项目模板</p>
      {data.message && <p>{data.message}</p>}
      <Link to="/detail">进入详情页</Link>
    </div>
  );
};

export default HomePage;
