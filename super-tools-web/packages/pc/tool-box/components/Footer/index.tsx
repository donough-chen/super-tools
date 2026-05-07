import React from 'react';
import { GithubOutlined, HeartFilled } from '@ant-design/icons';
import './index.less';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="footer">
      <div className="footer__inner">
        {/* 链接区域 */}
        <div className="footer__links">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__link"
          >
            <GithubOutlined />
            <span>GitHub</span>
          </a>
          <span className="footer__link-divider">·</span>
          <a href="#" className="footer__link">
            关于我们
          </a>
          <span className="footer__link-divider">·</span>
          <a href="#" className="footer__link">
            意见反馈
          </a>
          <span className="footer__link-divider">·</span>
          <a
            href="https://beian.miit.gov.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__link"
          >
            ICP备案号
          </a>
        </div>

        {/* 版权信息 */}
        <div className="footer__copyright">
          <span>© {currentYear} Super Tools. Made with </span>
          <HeartFilled className="footer__heart" />
          <span> by Donough</span>
        </div>

        {/* 客户端下载 */}
        <div className="footer__download">
          <span className="footer__download-label">客户端下载：</span>
          <a href="#" className="footer__download-link">
            Windows
          </a>
          <span className="footer__link-divider">·</span>
          <a href="#" className="footer__download-link">
            macOS
          </a>
          <span className="footer__link-divider">·</span>
          <a href="#" className="footer__download-link">
            Android
          </a>
        </div>
      </div>
    </div>
  );
};

export default Footer;
