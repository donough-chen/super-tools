import React, { useEffect } from 'react';
import { Button, Tooltip } from 'antd';
import {
  DownloadOutlined,
  PlusCircleOutlined,
  FireOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getToolsByCategory, TOOLS_LIST } from '@/utils/toolsData';
import { useTabsStore } from '@/store/tabs';
import { navigateTo } from '@/utils/navigator';
import ToolCard from '@/components/ToolCard';
import './index.less';

const Home: React.FC = () => {
  const categories = getToolsByCategory();
  const totalTools = TOOLS_LIST.length;
  const { setActiveKey } = useTabsStore();

  // // 进入首页时设置 active tab
  useEffect(() => {
    setActiveKey('/');
  }, []);

  return (
    <div className="home">
      {/* ===== 顶部 Banner ===== */}
      <div className="home__banner">
        <div className="home__banner-content">
          <h1 className="home__banner-title">
            <span className="home__banner-title-highlight">Super Tools</span>
            <br />
            在线工具箱
          </h1>
          <p className="home__banner-desc">
            汇聚 {totalTools}+ 款精选在线工具，视频、图片、PDF、编程、加密、查询一站搞定
          </p>
          <div className="home__banner-actions">
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              className="home__banner-btn-primary"
              onClick={() => {
                const firstCat = categories[0];
                if (firstCat?.tools[0]) {
                  navigateTo(firstCat.tools[0].path);
                }
              }}
            >
              立即使用
            </Button>
            <Button
              size="large"
              icon={<FireOutlined />}
              className="home__banner-btn-secondary"
            >
              热门工具
            </Button>
          </div>
        </div>
        <div className="home__banner-decoration">
          <div className="home__banner-circle-1" />
          <div className="home__banner-circle-2" />
          <div className="home__banner-circle-3" />
        </div>
      </div>

      {/* ===== 快捷入口 ===== */}
      <div className="home__quick-actions">
        <Tooltip title="查看下载队列">
          <div
            className="home__quick-action"
            onClick={() => navigateTo('/download-queue')}
          >
            <DownloadOutlined className="home__quick-action-icon" />
            <span>下载队列</span>
          </div>
        </Tooltip>
        <Tooltip title="申请添加新功能">
          <div className="home__quick-action">
            <PlusCircleOutlined className="home__quick-action-icon" />
            <span>添加功能</span>
          </div>
        </Tooltip>
        <div className="home__quick-stats">
          <div className="home__quick-stat">
            <span className="home__quick-stat-num">{totalTools}+</span>
            <span className="home__quick-stat-label">工具总数</span>
          </div>
          <div className="home__quick-stat">
            <span className="home__quick-stat-num">{categories.length}</span>
            <span className="home__quick-stat-label">工具分类</span>
          </div>
          <div className="home__quick-stat">
            <span className="home__quick-stat-num">100%</span>
            <span className="home__quick-stat-label">免费使用</span>
          </div>
        </div>
      </div>

      {/* ===== 工具分类列表 ===== */}
      {categories.map((category) => (
        <section
          key={category.name}
          className="home__category"
          id={`category-${encodeURIComponent(category.name)}`}
        >
          {/* 分类标题 */}
          <div className="home__category-header">
            <div className="home__category-title">
              <span className={`iconfont ${category.icon} home__category-icon`} />
              <h2 className="home__category-name">{category.name}</h2>
              <span className="home__category-count">
                {category.tools.length} 个工具
              </span>
            </div>
          </div>

          {/* 工具卡片网格 */}
          <div className="home__tools-grid">
            {category.tools.map((tool) => (
              <ToolCard key={tool.key} tool={tool} />
            ))}
          </div>
        </section>
      ))}

      {/* 底部间距 */}
      <div style={{ height: 40 }} />
    </div>
  );
};

export default Home;
