/**
 * ColorPickerModal 主题色选择弹窗
 *
 * 三大模块：
 *  1) 当前选择：色块 / HEX / RGB / 亮度
 *  2) 预设颜色：每行 5 个圆环，选中显示外圈高亮 + 中间 ✓；hover/touch 时在标题右侧显示色名
 *  3) 自定义 RGB：三条 0-255 进度条
 *
 * 行为：
 *  - 内部维护 draftColor（hex），点击「确定」回调 onConfirm(hex)
 *  - 关闭/取消则丢弃 draftColor
 */
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '../AppModal';
import './index.less';

/** 预设色项：可传 hex 字符串或 { name, hex } 对象 */
export type PresetColor = string | { name: string; hex: string };

export interface ColorPickerModalProps {
  visible: boolean;
  /** 外部当前主题色（hex） */
  value: string;
  /** 预设色板 */
  presets?: PresetColor[];
  onConfirm: (hex: string) => void;
  onClose: () => void;
}

const DEFAULT_PRESETS: PresetColor[] = [
  { name: '天空蓝', hex: '#4A90E2' },
  { name: '薄荷绿', hex: '#50C9A5' },
  { name: '薰衣草', hex: '#9B8EC4' },
  { name: '珊瑚橙', hex: '#FF6B6B' },
  { name: '阳光黄', hex: '#FFD93D' },
  { name: '活力橙', hex: '#FF8C42' },
  { name: '森林绿', hex: '#2D6A4F' },
  { name: '大地棕', hex: '#A0785A' },
  { name: '苔藓绿', hex: '#6B8F71' },
  { name: '深海蓝', hex: '#1A237E' },
  { name: '暗夜紫', hex: '#4A148C' },
  { name: '墨水黑', hex: '#263238' },
  { name: '樱花粉', hex: '#FFB7C5' },
  { name: '奶油白', hex: '#FFF8E7' },
  { name: '雾霾蓝', hex: '#B0C4DE' },
  { name: '玫瑰金', hex: '#B76E79' },
  { name: '铂金灰', hex: '#8E9EAB' },
  { name: '翡翠绿', hex: '#00897B' },
  { name: '拂晓蓝', hex: '#1677ff' },
  { name: '极光绿', hex: '#52c41a' },
  { name: '品红', hex: '#eb2f96' },
  { name: '日暮橙', hex: '#fa8c16' },
  { name: '酱紫', hex: '#722ed1' },
  { name: '明青', hex: '#13c2c2' },
  { name: '火焰红', hex: '#f5222d' },
  { name: '琥珀黄', hex: '#faad14' },
  { name: '极客蓝', hex: '#2f54eb' },
  { name: '青柠绿', hex: '#a0d911' },
];

// ==================== 颜色工具 ====================

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '').trim();
  const full =
    normalized.length === 3
      ? normalized.split('').map(c => c + c).join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return { r: 22, g: 119, b: 255 };
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const to2 = (v: number) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${to2(r)}${to2(g)}${to2(b)}`;
};

/** 感知亮度百分比（0-100） https://www.w3.org/TR/AERT/#color-contrast */
const luminance = (r: number, g: number, b: number) =>
  Math.round(((r * 299 + g * 587 + b * 114) / 1000 / 255) * 100);

/** 把任意 hex 归一化成大写 6 位形式，便于比较 */
const normalizeHex = (hex: string) => {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
};

/** 把 PresetColor 统一规整为 { name, hex } */
const normalizePreset = (p: PresetColor): { name: string; hex: string } =>
  typeof p === 'string' ? { name: p.toUpperCase(), hex: p } : p;

// ==================== 子组件：RGB 滑块 ====================

const RgbSlider: FC<{
  label: 'R' | 'G' | 'B';
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => {
  const trackBg =
    label === 'R'
      ? 'linear-gradient(to right, #000, #f00)'
      : label === 'G'
        ? 'linear-gradient(to right, #000, #0f0)'
        : 'linear-gradient(to right, #000, #00f)';

  return (
    <div className="color-picker-slider">
      <span className={`color-picker-slider__label color-picker-slider__label--${label.toLowerCase()}`}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={255}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="color-picker-slider__range"
        style={{ background: trackBg }}
      />
      <span className="color-picker-slider__value">{value}</span>
    </div>
  );
};

// ==================== 主组件 ====================

const ColorPickerModal: FC<ColorPickerModalProps> = ({
  visible,
  value,
  presets = DEFAULT_PRESETS,
  onConfirm,
  onClose,
}) => {
  const [draft, setDraft] = useState(() => normalizeHex(value));
  /** 当前 hover/touch 中的预设色名（移动端 touch 显示，PC mouseenter 显示） */
  const [hoverName, setHoverName] = useState<string | null>(null);
  /** touch 态短暂保留 tooltip 的定时器 */
  const hoverTimerRef = useRef<number | null>(null);

  // 每次打开同步外部值
  useEffect(() => {
    if (visible) setDraft(normalizeHex(value));
  }, [visible, value]);

  // 关闭时清理 hover 态与定时器
  useEffect(() => {
    if (!visible) {
      setHoverName(null);
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    }
  }, [visible]);

  const draftRgb = useMemo(() => hexToRgb(draft), [draft]);
  const draftLum = useMemo(() => luminance(draftRgb.r, draftRgb.g, draftRgb.b), [draftRgb]);
  const lumLabel = draftLum >= 67 ? '偏亮' : draftLum >= 35 ? '中等' : '偏暗';

  /** 规整后的预设列表 */
  const presetList = useMemo(() => presets.map(normalizePreset), [presets]);

  /** 反查 draft 是否命中预设：命中则返回色名，未命中（自定义色）返回空 */
  const draftPresetName = useMemo(() => {
    const hit = presetList.find(p => normalizeHex(p.hex) === draft);
    return hit?.name || '';
  }, [presetList, draft]);

  const setChannel = (key: 'r' | 'g' | 'b', v: number) => {
    const next = { ...draftRgb, [key]: v };
    setDraft(rgbToHex(next.r, next.g, next.b));
  };

  const handlePresetSelect = (item: { name: string; hex: string }) => {
    setDraft(normalizeHex(item.hex));
    // touch 设备点击后短暂显示色名（1.2s）便于反馈
    setHoverName(item.name);
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverName(null);
      hoverTimerRef.current = null;
    }, 1200);
  };

  const handleConfirm = () => {
    onConfirm(draft);
  };

  const content = (
    <div className="color-picker">
      {/* 模块 1：当前选择 */}
      <div className="color-picker__section">
        <div className="color-picker__section-title">当前选择</div>
        <div className="color-picker__current">
          <div
            className="color-picker__current-ring"
            style={{ background: draft }}
          />
          <div className="color-picker__current-info">
            {draftPresetName && (
              <div className="color-picker__current-row color-picker__current-row--name">
                <span className="color-picker__current-key">名称</span>
                <span className="color-picker__current-val color-picker__current-val--name" style={{ color: draft }}>
                  {draftPresetName}
                </span>
              </div>
            )}
            <div className="color-picker__current-row">
              <span className="color-picker__current-key">HEX</span>
              <span className="color-picker__current-val">{draft}</span>
            </div>
            <div className="color-picker__current-row">
              <span className="color-picker__current-key">RGB</span>
              <span className="color-picker__current-val">
                {draftRgb.r}, {draftRgb.g}, {draftRgb.b}
              </span>
            </div>
            <div className="color-picker__current-row">
              <span className="color-picker__current-key">亮度</span>
              <span className="color-picker__current-val">
                {draftLum}% <em className="color-picker__current-tag">{lumLabel}</em>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 模块 2：预设颜色 */}
      <div className="color-picker__section">
        <div className="color-picker__section-header">
          <span className="color-picker__section-title">预设颜色</span>
          <span
            className={`color-picker__hover-name${hoverName ? ' color-picker__hover-name--visible' : ''}`}
            aria-live="polite"
          >
            {hoverName || ''}
          </span>
        </div>
        <div className="color-picker__presets">
          {presetList.map(item => {
            const active = normalizeHex(item.hex) === draft;
            return (
              <button
                key={item.hex}
                type="button"
                className={`color-picker__preset${active ? ' color-picker__preset--active' : ''}`}
                onClick={() => handlePresetSelect(item)}
                onMouseEnter={() => setHoverName(item.name)}
                onMouseLeave={() => setHoverName(null)}
                onTouchStart={() => setHoverName(item.name)}
                aria-label={`${item.name} ${item.hex}`}
                title={item.name}
              >
                <span
                  className="color-picker__preset-ring"
                  style={{ background: item.hex }}
                >
                  {active && <span className="color-picker__preset-check" aria-hidden>✓</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 模块 3：自定义 RGB */}
      <div className="color-picker__section">
        <div className="color-picker__section-title">自定义颜色（RGB）</div>
        <div className="color-picker__sliders">
          <RgbSlider label="R" value={draftRgb.r} onChange={v => setChannel('r', v)} />
          <RgbSlider label="G" value={draftRgb.g} onChange={v => setChannel('g', v)} />
          <RgbSlider label="B" value={draftRgb.b} onChange={v => setChannel('b', v)} />
        </div>
      </div>
    </div>
  );

  return (
    <AppModal
      visible={visible}
      title="选择主题色"
      contentType="text"
      content={content}
      confirmText="确定"
      cancelText="取消"
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
    />
  );
};

export default ColorPickerModal;
