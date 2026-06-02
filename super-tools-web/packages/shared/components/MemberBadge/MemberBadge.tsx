// MemberBadge.tsx
import React, { useCallback } from 'react';
import './MemberBadge.less';
import { MemberBadgeProps, MemberLevel } from './types';
import { LEVEL_DEFAULT_CONFIG } from './constants';
import NormalIcon from './icons/NormalIcon';
import SilverIcon from './icons/SilverIcon';
import GoldIcon from './icons/GoldIcon';
import DiamondIcon from './icons/DiamondIcon';
import BlackGoldIcon from './icons/BlackGoldIcon';

// ==================== 映射表 ====================

const ICON_MAP: Record<MemberLevel, React.FC<{ size: number }>> = {
  normal:    NormalIcon,
  silver:    SilverIcon,
  gold:      GoldIcon,
  diamond:   DiamondIcon,
  blackgold: BlackGoldIcon,
};

/** SVG 发光动画 class */
const GLOW_CLASS_MAP: Record<string, string> = {
  'glow-gold':      'glow-gold',
  'glow-diamond':   'glow-diamond',
  'glow-blackgold': 'glow-blackgold',
};

/** 名称标签 class */
const NAME_CLASS_MAP: Record<MemberLevel, string> = {
  normal:    'name-normal',
  silver:    'name-silver',
  gold:      'name-gold',
  diamond:   'name-diamond',
  blackgold: 'name-blackgold',
};

/** 等级文案 class */
const LEVEL_CLASS_MAP: Record<MemberLevel, string> = {
  normal:    'level-normal',
  silver:    'level-silver',
  gold:      'level-gold',
  diamond:   'level-diamond',
  blackgold: 'level-blackgold',
};

// ==================== 工具函数 ====================

/** 合并 className，过滤空值 */
const cx = (...classes: (string | undefined | false | null)[]): string =>
  classes.filter(Boolean).join(' ');

// ==================== 组件 ====================

const MemberBadge: React.FC<MemberBadgeProps> = ({
  level,
  size = 80,
  showName = true,
  showLevel = true,
  customName,
  customLevel,
  className,
  style,
  onClick,
}) => {
  const config        = LEVEL_DEFAULT_CONFIG[level];
  const IconComponent = ICON_MAP[level];
  const glowClass     = GLOW_CLASS_MAP[config.animationClass] ?? '';
  const displayName   = customName  ?? config.name;
  const displayLevel  = customLevel ?? config.levelText;

  const handleClick = useCallback(() => {
    onClick?.(level);
  }, [onClick, level]);

  return (
    <div
      className={cx(
        'member-badge-wrapper',
        onClick && 'is-clickable',
        className,
      )}
      style={style}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && handleClick() : undefined}
      aria-label={`${displayName} 图标`}
    >
      {/* 图标 */}
      <div
        className={cx('member-badge-icon', glowClass)}
        style={{ width: size, height: size }}
      >
        <IconComponent size={size} />
      </div>

      {/* 名称 */}
      {showName && (
        <span
          className={cx('member-badge-name', NAME_CLASS_MAP[level])}
          style={{ fontSize: Math.max(10, size * 0.16) }}
        >
          {displayName}
        </span>
      )}

      {/* 等级文案 */}
      {showLevel && (
        <span
          className={cx('member-badge-level', LEVEL_CLASS_MAP[level])}
          style={{ fontSize: Math.max(8, size * 0.12) }}
        >
          {displayLevel}
        </span>
      )}
    </div>
  );
};

export default MemberBadge;