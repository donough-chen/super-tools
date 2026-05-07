/**
 * 使用帮助页 Help
 *
 * 二级页面：使用说明与常见问题
 */
import React from 'react';
import { history } from 'umi';
import AppHeader from '../../components/AppHeader';
import './index.less';

const helpItems = [
  { q: '如何使用工具？', a: '在首页找到您需要的工具，点击即可进入使用。' },
  { q: '如何收藏工具？', a: '在工具详情页中点击收藏按钮，即可将工具添加到收藏列表。' },
  { q: '如何切换展示模式？', a: '进入「我的」→「设置」，可自由切换工具列表和收藏列表的展示模式。' },
  { q: '如何修改主题色？', a: '进入「我的」→「设置」，在主题色选项中选择您喜欢的颜色。' },
  { q: '会员有什么特权？', a: '会员可解锁所有高级工具、去除广告、享受优先客服支持。' },
];

const HelpPage: React.FC = () => {
  return (
    <div className="page-help">
      <AppHeader title="使用帮助" showBack onBack={() => history.goBack()} />
      <main className="page-help__content">
        {helpItems.map((item, idx) => (
          <div key={idx} className="page-help__item">
            <h4 className="page-help__question">{item.q}</h4>
            <p className="page-help__answer">{item.a}</p>
          </div>
        ))}
      </main>
    </div>
  );
};

export default HelpPage;
