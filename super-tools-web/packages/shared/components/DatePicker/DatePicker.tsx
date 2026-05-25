/**
 * DatePicker —— 阻尼滚动日期选择器（年 / 月 / 日 联动）
 *
 * 设计要点：
 * 1. 基于 Picker（阻尼滚动）封装；视觉与 RegionPicker 保持一致
 * 2. 受控 / 非受控两用：
 *    - 受控：传 value（'YYYY-MM-DD'）
 *    - 非受控：仅传 defaultValue，组件内部维护
 * 3. 标量化对外：内部以 { year, month, day } 三列驱动 Picker；
 *    对外 onChange 直接给出格式化字符串 + 数字三段
 * 4. 范围裁剪：根据 minDate / maxDate 动态生成可选年/月/日列表
 * 5. 自愈：年或月切换后，若 day 超出该月天数（如 2 月 31），自动回退到该月最大值
 * 6. mode 控制：date（年月日，默认） / year-month（仅年月） / year（仅年）
 *
 * 用法：
 *   <DatePicker
 *     value="1995-08-15"
 *     minDate="1900-01-01"
 *     maxDate={new Date().toISOString().slice(0,10)}
 *     onChange={(v, parts) => setDate(v)}
 *   />
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Picker from '../Picker';
import './DatePicker.less';

export type DatePickerMode = 'date' | 'year-month' | 'year';

export interface DatePickerProps {
  /** 受控值（'YYYY-MM-DD'），优先级高于 defaultValue */
  value?: string;
  /** 非受控初始值（'YYYY-MM-DD'） */
  defaultValue?: string;
  /** 选中变更回调：标准 'YYYY-MM-DD' 字符串 + 数字三段 */
  onChange?: (
    value: string,
    parts: { year: number; month: number; day: number },
  ) => void;
  /** 最小日期（'YYYY-MM-DD'），默认 '1900-01-01' */
  minDate?: string;
  /** 最大日期（'YYYY-MM-DD'），默认 当天 */
  maxDate?: string;
  /** 选择模式，默认 'date'（年月日） */
  mode?: DatePickerMode;
  /** 容器高度（含遮罩） */
  height?: number;
  /** 单行高度 */
  itemHeight?: number;
  /** 是否在每列右侧附加单位（年/月/日），默认 true */
  showLabel?: boolean;
  /** 年单位文案，默认 '年' */
  yearLabel?: string;
  /** 月单位文案，默认 '月' */
  monthLabel?: string;
  /** 日单位文案，默认 '日' */
  dayLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/* ============================================================
 * 工具函数
 * ============================================================ */

/** 安全解析 'YYYY-MM-DD' → DateParts；解析失败返回 null */
function parseDateString(input?: string): DateParts | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

/** DateParts → 'YYYY-MM-DD' 标准格式 */
function formatDate(parts: DateParts): string {
  const yyyy = String(parts.year).padStart(4, '0');
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 取某年某月的天数（自动处理闰年） */
function daysInMonth(year: number, month: number): number {
  // new Date(year, month, 0) 取的是上月最后一天 → 即 month 月的天数
  return new Date(year, month, 0).getDate();
}

/** 比较两个 DateParts，返回 -1 / 0 / 1（a 与 b） */
function compareParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return 0;
}

/** 把 parts 夹到 [min, max] 范围内 */
function clampParts(parts: DateParts, min: DateParts, max: DateParts): DateParts {
  if (compareParts(parts, min) < 0) return { ...min };
  if (compareParts(parts, max) > 0) return { ...max };
  // 月份合法性兜底（外部传入的 day 可能超过该月天数）
  const dim = daysInMonth(parts.year, parts.month);
  if (parts.day > dim) {
    return { ...parts, day: dim };
  }
  return parts;
}

/** 范围内的整数序列 [from, to] */
function range(from: number, to: number): number[] {
  if (to < from) return [];
  const arr: number[] = new Array(to - from + 1);
  for (let i = 0; i <= to - from; i++) arr[i] = from + i;
  return arr;
}

/** 默认 min：1900-01-01 */
const DEFAULT_MIN: DateParts = { year: 1900, month: 1, day: 1 };

/** 默认 max：当天 */
function getDefaultMax(): DateParts {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/* ============================================================
 * 组件
 * ============================================================ */

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  defaultValue,
  onChange,
  minDate,
  maxDate,
  mode = 'date',
  height = 240,
  itemHeight = 44,
  showLabel = true,
  yearLabel = '年',
  monthLabel = '月',
  dayLabel = '日',
  className,
  style,
}) => {
  /* -------- 解析 min / max -------- */
  const min = useMemo<DateParts>(
    () => parseDateString(minDate) || DEFAULT_MIN,
    [minDate],
  );
  const max = useMemo<DateParts>(
    () => parseDateString(maxDate) || getDefaultMax(),
    [maxDate],
  );

  /* -------- 初始值（优先 value，其次 defaultValue，否则 max） -------- */
  const initialParts = useMemo<DateParts>(() => {
    const parsed = parseDateString(value) || parseDateString(defaultValue);
    const start = parsed || max; // 默认定位到最大值（一般是当天）
    return clampParts(start, min, max);
  }, [value, defaultValue, min, max]);

  /* -------- 内部状态：受控时由 useEffect 同步外部 value -------- */
  const [parts, setParts] = useState<DateParts>(initialParts);

  // 外部 value 受控同步（仅在受控且解析成功时覆盖）
  useEffect(() => {
    if (value === undefined) return;
    const parsed = parseDateString(value);
    if (!parsed) return;
    const next = clampParts(parsed, min, max);
    setParts(prev =>
      prev.year === next.year && prev.month === next.month && prev.day === next.day
        ? prev
        : next,
    );
  }, [value, min, max]);

  // min / max 变化时也做一次自愈（避免越界）
  useEffect(() => {
    setParts(prev => {
      const clamped = clampParts(prev, min, max);
      if (
        clamped.year === prev.year &&
        clamped.month === prev.month &&
        clamped.day === prev.day
      ) {
        return prev;
      }
      return clamped;
    });
  }, [min, max]);

  /* -------- 各列动态选项（受 min/max + 当前选中年/月 影响） -------- */
  const yearOptions = useMemo(() => range(min.year, max.year), [min.year, max.year]);

  const monthOptions = useMemo(() => {
    let from = 1;
    let to = 12;
    if (parts.year === min.year) from = Math.max(from, min.month);
    if (parts.year === max.year) to = Math.min(to, max.month);
    return range(from, to);
  }, [parts.year, min, max]);

  const dayOptions = useMemo(() => {
    const dim = daysInMonth(parts.year, parts.month);
    let from = 1;
    let to = dim;
    if (parts.year === min.year && parts.month === min.month) {
      from = Math.max(from, min.day);
    }
    if (parts.year === max.year && parts.month === max.month) {
      to = Math.min(to, max.day);
    }
    return range(from, to);
  }, [parts.year, parts.month, min, max]);

  /* -------- emit 工具 -------- */
  const emit = useCallback(
    (next: DateParts) => {
      if (!onChange) return;
      onChange(formatDate(next), { ...next });
    },
    [onChange],
  );

  /* -------- Picker onChange 处理（联动 + 自愈） -------- */
  const handlePickerChange = useCallback(
    (next: { [k: string]: string | number }, key: string) => {
      const ny = Number(next.year ?? parts.year);
      let nm = Number(next.month ?? parts.month);
      let nd = Number(next.day ?? parts.day);

      // 年变化 → 校正月份范围
      if (key === 'year') {
        let mFrom = 1;
        let mTo = 12;
        if (ny === min.year) mFrom = Math.max(mFrom, min.month);
        if (ny === max.year) mTo = Math.min(mTo, max.month);
        if (nm < mFrom) nm = mFrom;
        if (nm > mTo) nm = mTo;
      }

      // 月变化（或年变化导致月被改） → 校正日范围（含该月天数）
      if (key === 'year' || key === 'month') {
        const dim = daysInMonth(ny, nm);
        let dFrom = 1;
        let dTo = dim;
        if (ny === min.year && nm === min.month) dFrom = Math.max(dFrom, min.day);
        if (ny === max.year && nm === max.month) dTo = Math.min(dTo, max.day);
        if (nd < dFrom) nd = dFrom;
        if (nd > dTo) nd = dTo;
      }

      const nextParts: DateParts = { year: ny, month: nm, day: nd };
      const clamped = clampParts(nextParts, min, max);
      setParts(clamped);
      emit(clamped);
    },
    [parts, min, max, emit],
  );

  /* -------- 渲染 -------- */
  const showMonth = mode === 'date' || mode === 'year-month';
  const showDay = mode === 'date';

  // Picker value：仅包含当前 mode 涉及的列，避免列重置时不必要的引用变化
  const pickerValue = useMemo(() => {
    const v: { year: number; month?: number; day?: number } = { year: parts.year };
    if (showMonth) v.month = parts.month;
    if (showDay) v.day = parts.day;
    return v;
  }, [parts.year, parts.month, parts.day, showMonth, showDay]);

  return (
    <div
      className={['date-picker', className].filter(Boolean).join(' ')}
      style={style}
    >
      <Picker
        value={pickerValue as any}
        onChange={handlePickerChange as any}
        height={height}
        itemHeight={itemHeight}
        wheelMode="natural"
      >
        {/* 年 */}
        <Picker.Column name="year">
          {yearOptions.map(y => (
            <Picker.Item key={y} value={y}>
              {({ selected }) => (
                <span
                  className={`date-picker__text ${selected ? 'date-picker__text--active' : ''}`}
                >
                  {y}
                  {showLabel ? yearLabel : ''}
                </span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>

        {/*
          月
          注意：不要给 Column 加基于上级 id 的 key（如 `month-${year}`），
          否则每次年份变化都会让月份列整列卸载重建，PickerColumn 内部要
          先 mount → useLayoutEffect 才校正 translate，视觉上会看到
          列表从顶部滑到选中项的过渡（300ms transition）。
          实际上：滚动年份只会让 options 内容/长度变化，PickerColumn 内
          的 useLayoutEffect（依赖 selectedIndex / options.length）会自然
          同步把 translate 校正到正确位置，无需重建整列。
        */}
        {showMonth && (
          <Picker.Column name="month">
            {monthOptions.map(m => (
              <Picker.Item key={m} value={m}>
                {({ selected }) => (
                  <span
                    className={`date-picker__text ${selected ? 'date-picker__text--active' : ''}`}
                  >
                    {m}
                    {showLabel ? monthLabel : ''}
                  </span>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        )}

        {/* 日 —— 同上：不加 key，避免每次年/月变化时整列重建造成视觉抖动 */}
        {showDay && (
          <Picker.Column name="day">
            {dayOptions.map(d => (
              <Picker.Item key={d} value={d}>
                {({ selected }) => (
                  <span
                    className={`date-picker__text ${selected ? 'date-picker__text--active' : ''}`}
                  >
                    {d}
                    {showLabel ? dayLabel : ''}
                  </span>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        )}
      </Picker>
    </div>
  );
};

export default DatePicker;
