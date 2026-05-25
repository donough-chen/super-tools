/**
 * RegionPicker —— 省市区三级联动选择器
 *
 * 设计要点：
 * 1. 基于 Picker（阻尼滚动）封装，对外只暴露 value（行政区划 id）+ onChange
 * 2. 数据请求由调用方完成，组件内部仅消费已传入的 tree 数据，不发任何网络请求
 * 3. 自动处理"该级数据为空"（如直辖市没有"区"）：自动忽略缺失列
 * 4. 受控/非受控两用：
 *    - 受控：传入 value（叶子节点 id），组件内部根据 tree 反查路径
 *    - 仅初始定位：使用 defaultValue
 * 5. 滚动选择仅修改组件内部状态，确认提交由父组件通过外层 Modal 控制
 * 6. 可选搜索（searchable=true 启用）：
 *    - 顶部搜索栏，支持中文/拼音匹配，命中省/市/区任意层级
 *    - 实时搜索 + 防抖；本地索引 + 关键字缓存
 *    - 结果点击 → 自动定位到对应省市区层级 → 关闭搜索界面
 *
 * 用法：
 *   <RegionPicker
 *     tree={regions}
 *     value={code}
 *     searchable           // 可选：开启搜索
 *     onChange={(id, path) => ...}
 *   />
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Picker from '../Picker';
import './RegionPicker.less';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RegionPickerNode {
  id: string;
  name: string;
  fullname: string;
  pinyin?: string;
  cids?: RegionPickerNode[];
}

export interface RegionPickerPath {
  province?: RegionPickerNode;
  city?: RegionPickerNode;
  district?: RegionPickerNode;
}

export interface RegionPickerProps {
  /** 完整省市区树（由父组件通过接口获取并传入） */
  tree: RegionPickerNode[];
  /** 当前选中的最末级 id（如区/县 id；若仅省/市，则为对应级 id） */
  value?: string;
  /** 选中变更回调：返回最末级 id 与完整路径 */
  onChange?: (id: string, path: RegionPickerPath) => void;
  /** 容器高度（含遮罩） */
  height?: number;
  /** 单行高度 */
  itemHeight?: number;
  /** 是否启用搜索功能（默认 false，不展示搜索框） */
  searchable?: boolean;
  /** 搜索框占位文本 */
  searchPlaceholder?: string;
  /** 搜索结果最大展示条数（超过则显示"还有 N 条"），默认 100 */
  maxSearchResults?: number;
  /** 搜索防抖时间（ms），默认 200 */
  searchDebounce?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface PickerInternalValue {
  province: string;
  city: string;
  district: string;
}

/** 索引项：扁平化的叶子+中间节点，含完整路径 */
interface SearchIndexItem {
  /** 末级 id */
  leafId: string;
  /** 命中的层级 */
  level: 'province' | 'city' | 'district';
  /** 完整路径节点（用于点击定位） */
  province: RegionPickerNode;
  city?: RegionPickerNode;
  district?: RegionPickerNode;
  /** 用于匹配/展示的字段 */
  fullname: string;       // 末级 fullname
  pathText: string;       // "广东省 / 深圳市 / 南山区"
  matchText: string;      // 用于中文匹配的文本（小写）
  matchPinyin: string;    // 用于拼音匹配的文本（小写、无空格）
}

const EMPTY_NODE: RegionPickerNode = { id: '', name: '', fullname: '' };

/** 在 tree 中根据 id 反查 [province, city, district] 路径 */
function findPathById(
  tree: RegionPickerNode[],
  id: string | undefined,
): [RegionPickerNode | null, RegionPickerNode | null, RegionPickerNode | null] {
  if (!id || !tree || tree.length === 0) return [null, null, null];
  for (const province of tree) {
    if (province.id === id) return [province, null, null];
    for (const city of province.cids || []) {
      if (city.id === id) return [province, city, null];
      for (const district of city.cids || []) {
        if (district.id === id) return [province, city, district];
      }
    }
  }
  return [null, null, null];
}

/** 构建搜索索引：把 tree 拍平为数组（含三级所有节点） */
function buildSearchIndex(tree: RegionPickerNode[]): SearchIndexItem[] {
  const list: SearchIndexItem[] = [];
  for (const province of tree) {
    const pName = province.name || province.fullname || '';
    const pPinyin = (province.pinyin || '').replace(/\s+/g, '').toLowerCase();
    const pPath = province.fullname || pName;
    list.push({
      leafId: province.id,
      level: 'province',
      province,
      fullname: province.fullname || pName,
      pathText: pPath,
      matchText: `${pName}${province.fullname || ''}`.toLowerCase(),
      matchPinyin: pPinyin,
    });

    for (const city of province.cids || []) {
      const cName = city.name || city.fullname || '';
      const cPinyin = (city.pinyin || '').replace(/\s+/g, '').toLowerCase();
      const cPath = `${province.fullname || pName} / ${city.fullname || cName}`;
      list.push({
        leafId: city.id,
        level: 'city',
        province,
        city,
        fullname: city.fullname || cName,
        pathText: cPath,
        matchText: `${cName}${city.fullname || ''}`.toLowerCase(),
        matchPinyin: `${pPinyin}${cPinyin}`,
      });

      for (const district of city.cids || []) {
        const dName = district.name || district.fullname || '';
        const dPinyin = (district.pinyin || '').replace(/\s+/g, '').toLowerCase();
        const dPath = `${province.fullname || pName} / ${city.fullname || cName} / ${district.fullname || dName}`;
        list.push({
          leafId: district.id,
          level: 'district',
          province,
          city,
          district,
          fullname: district.fullname || dName,
          pathText: dPath,
          matchText: `${dName}${district.fullname || ''}`.toLowerCase(),
          matchPinyin: `${pPinyin}${cPinyin}${dPinyin}`,
        });
      }
    }
  }
  return list;
}

/** 判断关键字是否纯英文/字母/数字（视为拼音） */
function isPinyinKeyword(kw: string): boolean {
  return /^[a-z0-9\s]+$/i.test(kw);
}

/** 把字符串里的关键字片段包成 <mark> */
function highlight(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text;
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKw);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="region-picker__hl">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

const RegionPicker: React.FC<RegionPickerProps> = ({
  tree,
  value,
  onChange,
  height = 240,
  itemHeight = 44,
  searchable = false,
  searchPlaceholder = '搜索省/市/区，支持拼音',
  maxSearchResults = 100,
  searchDebounce = 200,
  className,
  style,
}) => {
  // 默认定位：根据 value 反查路径；否则取 tree 第一项的第一项的第一项
  const initialPath = useMemo<PickerInternalValue>(() => {
    const [p, c, d] = findPathById(tree, value);
    const province = p ?? tree[0] ?? EMPTY_NODE;
    const cityList = province?.cids || [];
    const city = c ?? cityList[0] ?? EMPTY_NODE;
    const districtList = city?.cids || [];
    const district = d ?? districtList[0] ?? EMPTY_NODE;
    return {
      province: province.id,
      city: city.id,
      district: district.id,
    };
  }, [tree, value]);

  const [pickerValue, setPickerValue] = useState<PickerInternalValue>(initialPath);

  // 当外部 value / tree 变化时，同步内部值
  useEffect(() => {
    setPickerValue(initialPath);
  }, [initialPath]);

  // 当前省/市对象
  const currentProvince = useMemo(
    () => tree.find(n => n.id === pickerValue.province),
    [tree, pickerValue.province],
  );
  const cityList = useMemo(() => currentProvince?.cids || [], [currentProvince]);

  const currentCity = useMemo(
    () => cityList.find(n => n.id === pickerValue.city),
    [cityList, pickerValue.city],
  );
  const districtList = useMemo(() => currentCity?.cids || [], [currentCity]);

  // 自愈：当上级切换后，若当前 city / district 已不在新列表里，自动校正到第一项
  useEffect(() => {
    const cityValid = cityList.some(n => n.id === pickerValue.city);
    if (!cityValid) {
      const nextCity = cityList[0]?.id || '';
      const nextDistrict = cityList[0]?.cids?.[0]?.id || '';
      if (nextCity !== pickerValue.city || nextDistrict !== pickerValue.district) {
        setPickerValue(prev => ({ ...prev, city: nextCity, district: nextDistrict }));
      }
      return;
    }
    const districtValid = districtList.length === 0
      ? pickerValue.district === ''
      : districtList.some(n => n.id === pickerValue.district);
    if (!districtValid) {
      const nextDistrict = districtList[0]?.id || '';
      if (nextDistrict !== pickerValue.district) {
        setPickerValue(prev => ({ ...prev, district: nextDistrict }));
      }
    }
  }, [cityList, districtList, pickerValue.city, pickerValue.district]);

  /** 通用：根据 path 触发 onChange 回调 */
  const emitChange = useCallback(
    (path: RegionPickerPath) => {
      if (!onChange) return;
      const leaf = path.district || path.city || path.province;
      onChange(leaf?.id || '', path);
    },
    [onChange],
  );

  /** Picker 滚动回调：处理级联（上级变了，下级要重置） */
  const handlePickerChange = useCallback(
    (next: { [k: string]: string | number }, key: string) => {
      let nextProvinceId = String(next.province ?? pickerValue.province);
      let nextCityId = String(next.city ?? pickerValue.city);
      let nextDistrictId = String(next.district ?? pickerValue.district);

      if (key === 'province') {
        const province = tree.find(n => n.id === nextProvinceId);
        const newCityList = province?.cids || [];
        nextCityId = newCityList[0]?.id || '';
        const newDistrictList = newCityList[0]?.cids || [];
        nextDistrictId = newDistrictList[0]?.id || '';
      } else if (key === 'city') {
        const province = tree.find(n => n.id === nextProvinceId);
        const newCityList = province?.cids || [];
        const city = newCityList.find(n => n.id === nextCityId);
        const newDistrictList = city?.cids || [];
        nextDistrictId = newDistrictList[0]?.id || '';
      }

      const nextValue: PickerInternalValue = {
        province: nextProvinceId,
        city: nextCityId,
        district: nextDistrictId,
      };
      setPickerValue(nextValue);

      const province = tree.find(n => n.id === nextValue.province);
      const city = province?.cids?.find(n => n.id === nextValue.city);
      const district = city?.cids?.find(n => n.id === nextValue.district);
      emitChange({
        province: province || undefined,
        city: city || undefined,
        district: district || undefined,
      });
    },
    [tree, pickerValue, emitChange],
  );

  // ============================================================
  // 搜索功能（searchable 开关控制）
  // ============================================================

  /** 搜索界面是否打开 */
  const [searchOpen, setSearchOpen] = useState(false);
  /** 输入框实时值 */
  const [keyword, setKeyword] = useState('');
  /** 防抖后的搜索值 */
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // 防抖：keyword → debouncedKeyword
  useEffect(() => {
    if (!searchable) return;
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), searchDebounce);
    return () => clearTimeout(timer);
  }, [keyword, searchDebounce, searchable]);

  // 搜索索引：tree 变化时构建
  const searchIndex = useMemo(
    () => (searchable ? buildSearchIndex(tree) : []),
    [tree, searchable],
  );

  // 搜索结果缓存：keyword → SearchIndexItem[]
  const cacheRef = useRef<Map<string, SearchIndexItem[]>>(new Map());
  // tree 变化时清空缓存
  useEffect(() => {
    cacheRef.current.clear();
  }, [searchIndex]);

  /** 计算搜索结果（命中 + 限制条数） */
  const { results, totalCount } = useMemo<{ results: SearchIndexItem[]; totalCount: number }>(() => {
    if (!searchable || !debouncedKeyword) {
      return { results: [], totalCount: 0 };
    }
    const cached = cacheRef.current.get(debouncedKeyword);
    if (cached) {
      return { results: cached.slice(0, maxSearchResults), totalCount: cached.length };
    }

    const lowerKw = debouncedKeyword.toLowerCase();
    const isPinyin = isPinyinKeyword(debouncedKeyword);
    const hits: SearchIndexItem[] = [];
    for (const item of searchIndex) {
      // 拼音匹配（关键字纯字母时优先），同时也支持中文匹配作为兜底
      const matched = isPinyin
        ? item.matchPinyin.includes(lowerKw) || item.matchText.includes(lowerKw)
        : item.matchText.includes(lowerKw);
      if (matched) hits.push(item);
    }
    cacheRef.current.set(debouncedKeyword, hits);
    return { results: hits.slice(0, maxSearchResults), totalCount: hits.length };
  }, [searchable, debouncedKeyword, searchIndex, maxSearchResults]);

  /** 点击搜索结果 → 定位 + 关闭搜索 */
  const handleResultClick = useCallback(
    (item: SearchIndexItem) => {
      const nextValue: PickerInternalValue = {
        province: item.province.id,
        city: item.city?.id || (item.province.cids?.[0]?.id ?? ''),
        district:
          item.district?.id ||
          (item.city?.cids?.[0]?.id ?? item.province.cids?.[0]?.cids?.[0]?.id ?? ''),
      };
      setPickerValue(nextValue);

      // 触发 onChange，path 以最深匹配层级为准
      emitChange({
        province: item.province,
        city: item.city,
        district: item.district,
      });

      // 关闭搜索界面、清空关键字
      setSearchOpen(false);
      setKeyword('');
      setDebouncedKeyword('');
    },
    [emitChange],
  );

  /** 关闭搜索（取消按钮） */
  const handleCancelSearch = useCallback(() => {
    setSearchOpen(false);
    setKeyword('');
    setDebouncedKeyword('');
  }, []);

  /** 清除输入 */
  const handleClearKeyword = useCallback(() => {
    setKeyword('');
    setDebouncedKeyword('');
  }, []);

  // 兜底：tree 为空时给个占位
  if (!tree || tree.length === 0) {
    return (
      <div
        className={['region-picker', className].filter(Boolean).join(' ')}
        style={{
          ...style,
          height: height + (searchable ? 56 : 0),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 14,
        }}
      >
        地区数据加载中...
      </div>
    );
  }

  // 是否需要展示"区/县"列
  const showDistrict = districtList.length > 0;

  return (
    <div
      className={['region-picker', className].filter(Boolean).join(' ')}
      style={style}
    >
      {/* ========== 搜索栏（searchable 开启时展示） ========== */}
      {searchable && (
        <div className="region-picker__search-bar">
          <div className="region-picker__search-input-wrap">
            <span className="region-picker__search-icon" aria-hidden>🔍</span>
            <input
              className="region-picker__search-input"
              type="search"
              placeholder={searchPlaceholder}
              value={keyword}
              onFocus={() => setSearchOpen(true)}
              onChange={e => {
                setKeyword(e.target.value);
                if (!searchOpen) setSearchOpen(true);
              }}
            />
            {keyword && (
              <button
                type="button"
                className="region-picker__search-clear"
                onClick={handleClearKeyword}
                aria-label="清除"
              >
                ✕
              </button>
            )}
          </div>
          {searchOpen && (
            <button
              type="button"
              className="region-picker__search-cancel"
              onClick={handleCancelSearch}
            >
              取消
            </button>
          )}
        </div>
      )}

      {/* ========== 搜索结果列表（搜索打开时覆盖 Picker） ========== */}
      {searchable && searchOpen ? (
        <div
          className="region-picker__results"
          // 显式设置 height 使其与常规 Picker 模式保持一致的纵向尺寸；
          // less 中 flex:0 0 auto 配合，避免被父级 flex 容器以 flex-basis:0% 压缩。
          style={{ height, boxSizing: 'border-box' }}
        >
          {!debouncedKeyword ? (
            <div className="region-picker__results-empty">输入关键词搜索省/市/区</div>
          ) : results.length === 0 ? (
            <div className="region-picker__results-empty">未找到匹配的地区</div>
          ) : (
            <>
              <ul className="region-picker__results-list">
                {results.map(item => (
                  <li
                    key={`${item.level}-${item.leafId}`}
                    className="region-picker__results-item"
                    onClick={() => handleResultClick(item)}
                  >
                    <span className="region-picker__results-name">
                      {highlight(item.fullname, debouncedKeyword)}
                    </span>
                    <span className="region-picker__results-path">
                      {highlight(item.pathText, debouncedKeyword)}
                    </span>
                  </li>
                ))}
              </ul>
              {totalCount > results.length && (
                <div className="region-picker__results-more">
                  仅显示前 {results.length} 条，还有 {totalCount - results.length} 条匹配，请输入更精确的关键词
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ========== 常规联动 Picker ========== */
        <Picker
          value={pickerValue as any}
          onChange={handlePickerChange as any}
          height={height}
          itemHeight={itemHeight}
          wheelMode="natural"
        >
          {/* 省 */}
          <Picker.Column name="province">
            {tree.map(p => (
              <Picker.Item key={p.id} value={p.id}>
                {({ selected }) => (
                  <span
                    className={`region-picker__text ${selected ? 'region-picker__text--active' : ''}`}
                  >
                    {p.name || p.fullname}
                  </span>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>

          {/* 市 —— 用 province id 做 key */}
          <Picker.Column key={`city-${pickerValue.province || 'none'}`} name="city">
            {cityList.length > 0
              ? cityList.map(c => (
                  <Picker.Item key={c.id} value={c.id}>
                    {({ selected }) => (
                      <span
                        className={`region-picker__text ${selected ? 'region-picker__text--active' : ''}`}
                      >
                        {c.name || c.fullname}
                      </span>
                    )}
                  </Picker.Item>
                ))
              : (
                <Picker.Item value="">
                  <span className="region-picker__text region-picker__text--empty">—</span>
                </Picker.Item>
              )}
          </Picker.Column>

          {/* 区/县 —— 用 city id 做 key */}
          {showDistrict && (
            <Picker.Column key={`district-${pickerValue.city || 'none'}`} name="district">
              {districtList.map(d => (
                <Picker.Item key={d.id} value={d.id}>
                  {({ selected }) => (
                    <span
                      className={`region-picker__text ${selected ? 'region-picker__text--active' : ''}`}
                    >
                      {d.name || d.fullname}
                    </span>
                  )}
                </Picker.Item>
              ))}
            </Picker.Column>
          )}
        </Picker>
      )}
    </div>
  );
};

export default RegionPicker;
