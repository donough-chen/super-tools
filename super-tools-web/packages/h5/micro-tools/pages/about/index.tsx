/**
 * 关于我们页 About
 *
 * 二级页面：应用介绍、版本信息
 */
import React from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import './index.less';

const AboutPage: React.FC = () => {
  return (
    <div className="page-about">
      <AppHeader title="关于我们" showBack onBack={() => navigateBack()} />
      <main className="page-about__content">
        <div className="page-about__logo">
          <img src="https://via.placeholder.com/120" alt="Logo" />
        </div>
        <h2 className="page-about__app-name">超级工具</h2>
        <p className="page-about__version">版本 v0.1.0</p>
        <div className="page-about__desc">
          <p>超级工具是一款集合多种实用在线工具的 H5 应用。</p>
          <p>我们致力于为用户提供高效、便捷的工具服务。</p>
        </div>
        <div className="page-about__links">
          <div className="page-about__link-item">
            <span>官方网站</span>
            <span className="page-about__arrow" />
          </div>
          <div className="page-about__link-item">
            <span>用户协议</span>
            <span className="page-about__arrow" />
          </div>
          <div className="page-about__link-item">
            <span>隐私政策</span>
            <span className="page-about__arrow" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;
