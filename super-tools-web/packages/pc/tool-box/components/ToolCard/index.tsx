import React from 'react';
import { navigateTo } from '@/utils/navigator';
import classNames from 'classnames';
import type { ToolItem } from '@/utils/toolsData';
import { useTabsStore } from '@/store/tabs';
import './index.less';

interface ToolCardProps {
  tool: ToolItem;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const { addTab } = useTabsStore();

  const handleClick = () => {
    addTab({ key: tool.path, title: tool.name, path: tool.path, closable: true });
    navigateTo(tool.path);
  };

  return (
    <div className="tool-card" onClick={handleClick}>
      {/* 工具图标 */}
      <div className="tool-card__icon-wrap">
        <span
          className={classNames('iconfont', `icon-${tool.key}`, 'tool-card__icon')}
        />
      </div>

      {/* 工具信息 */}
      <div className="tool-card__info">
        <h3 className="tool-card__name">{tool.name}</h3>
        <p className="tool-card__desc">{tool.description}</p>
      </div>

      {/* 悬浮箭头 */}
      <div className="tool-card__arrow">→</div>
    </div>
  );
};

export default ToolCard;
