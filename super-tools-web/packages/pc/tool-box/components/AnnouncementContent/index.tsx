import React, { useMemo } from 'react';
import './index.less';

interface AnnouncementContentProps {
  content: string;
}

/**
 * 简易 Markdown 渲染组件
 * 支持：标题(#/##/###)、加粗(**text**)、列表(- item)、段落、水平线(---)
 */
const AnnouncementContent: React.FC<AnnouncementContentProps> = ({ content }) => {
  const rendered = useMemo(() => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={key++} className="ann-content__list">
            {listItems.map((item, i) => (
              <li key={i} className="ann-content__list-item" dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
            ))}
          </ul>,
        );
        listItems = [];
      }
    };

    // 处理行内样式：加粗、行内代码
    const parseInline = (text: string): string => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code class="ann-content__code">$1</code>');
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 标题
      if (line.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={key++} className="ann-content__h3">{line.slice(4)}</h3>);
        continue;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={key++} className="ann-content__h2">{line.slice(3)}</h2>);
        continue;
      }
      if (line.startsWith('# ')) {
        flushList();
        elements.push(<h1 key={key++} className="ann-content__h1">{line.slice(2)}</h1>);
        continue;
      }

      // 水平线
      if (/^---+$/.test(line.trim())) {
        flushList();
        elements.push(<hr key={key++} className="ann-content__hr" />);
        continue;
      }

      // 列表项
      if (line.startsWith('- ') || line.startsWith('* ')) {
        listItems.push(line.slice(2));
        continue;
      }

      // 空行
      if (line.trim() === '') {
        flushList();
        continue;
      }

      // 普通段落
      flushList();
      elements.push(
        <p
          key={key++}
          className="ann-content__p"
          dangerouslySetInnerHTML={{ __html: parseInline(line) }}
        />,
      );
    }

    flushList();
    return elements;
  }, [content]);

  return <div className="ann-content">{rendered}</div>;
};

export default AnnouncementContent;
