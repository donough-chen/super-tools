/**
 * 搜索页 Search
 *
 * 二级页面：搜索框 + 搜索历史 + 搜索结果列表
 */
import React, { useState, useCallback, useRef } from 'react';
import { useHistory } from 'umi';
import { searchTools } from '../../service';
import AppHeader from '../../components/AppHeader';
import type { ToolItem } from '../../store/home';
import './index.less';

const SearchPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<ToolItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const history = useHistory();

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return;
    setSearching(true);
    try {
      const res = await searchTools(keyword);
      setResults((res?.code === 0 && res.data) ? res.data : []);
    } catch (err) {
      console.error('[Search] error:', err);
    }
    setSearching(false);
  }, [keyword]);

  return (
    <div className="page-search">
      <AppHeader
        title="搜索"
        showBack
        onBack={() => history.goBack()}
      />
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
              <div key={tool.id} className="page-search__item" onClick={() => history.push(tool.url)}>
                <img className="page-search__icon" src={tool.icon || 'https://via.placeholder.com/64'} alt={tool.name} />
                <div className="page-search__info">
                  <span className="page-search__name">{tool.name}</span>
                  {tool.subtitle && <span className="page-search__subtitle">{tool.subtitle}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : keyword ? (
          <div className="page-search__status">暂无搜索结果</div>
        ) : null}
      </main>
    </div>
  );
};

export default SearchPage;
