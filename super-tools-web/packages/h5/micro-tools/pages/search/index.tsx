/**
 * 搜索页 Search（重构版）
 *
 * 二级页面：搜索框 + 搜索结果列表
 * 接入新后端：GET /api/tools/home?keyword=xxx（分页模式）
 */
import React, { useState, useCallback, useRef } from 'react';
import { useHistory } from 'umi';
import { getHome } from '../../service/tool';
import { useToolClick } from '../../hooks/useToolClick';
import AppHeader from '../../components/AppHeader';
import AppModal from '../../components/AppModal';
import type { Tool } from '../../types/tool';
import { resolveIcon } from '../../utils/icon';
import './index.less';

const SearchPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Tool[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { onClick: handleToolClick, dialog, closeDialog } = useToolClick();

  const history = useHistory();

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return;
    setSearching(true);
    try {
      const res: any = await getHome({ keyword: keyword.trim(), page: 1, pageSize: 50 });
      if (res?.code === 200 && Array.isArray(res.data?.tools?.list)) {
        setResults(res.data.tools.list as Tool[]);
      } else {
        setResults([]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Search] error:', err);
      setResults([]);
    }
    setSearching(false);
  }, [keyword]);

  return (
    <div className="page-search">
      <AppHeader title="搜索" showBack onBack={() => history.goBack()} />

      <main className="page-search__content">
        <div className="page-search__input-wrap">
          <input
            ref={inputRef}
            className="page-search__input"
            type="text"
            placeholder="搜索工具..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <button className="page-search__btn" onClick={handleSearch}>搜索</button>
        </div>

        {searching ? (
          <div className="page-search__status">搜索中...</div>
        ) : results.length > 0 ? (
          <div className="page-search__results">
            {results.map(tool => (
              <div
                key={tool.code}
                className="page-search__item"
                onClick={() => handleToolClick(tool)}
              >
                <img
                  className="page-search__icon"
                  src={resolveIcon(tool.icon) || 'https://via.placeholder.com/64'}
                  alt={tool.name}
                  style={{ backgroundColor: tool.color || 'transparent' }}
                />
                <div className="page-search__info">
                  <span className="page-search__name">{tool.name}</span>
                  {tool.description && (
                    <span className="page-search__subtitle">{tool.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : keyword ? (
          <div className="page-search__status">暂无搜索结果</div>
        ) : null}
      </main>

      <AppModal
        visible={dialog.visible}
        title={dialog.title}
        content={dialog.message}
        confirmText={dialog.confirmText}
        cancelText="取消"
        onConfirm={dialog.onConfirm || closeDialog}
        onCancel={closeDialog}
        onClose={closeDialog}
      />
    </div>
  );
};

export default SearchPage;
