// MemberBadgeGroup.tsx
import React from 'react';
import './MemberBadge.less';
import { MemberBadgeGroupProps } from './types';
import { ALL_LEVELS } from './constants';
import MemberBadge from './MemberBadge';

/** 合并 className，过滤空值 */
const cx = (...classes: (string | undefined | false | null)[]): string =>
  classes.filter(Boolean).join(' ');

const MemberBadgeGroup: React.FC<MemberBadgeGroupProps> = ({
  levels,
  direction = 'horizontal',
  size = 80,
  gap = 24,
  showName = true,
  showLevel = true,
  levelConfigs,
  className,
  style,
  onClick,
}) => {
  const displayLevels = levels ?? ALL_LEVELS;

  return (
    <div
      className={cx(
        'member-badge-group',
        `direction-${direction}`,
        className,
      )}
      style={{ gap, ...style }}
    >
      {displayLevels.map((level) => {
        const levelConfig = levelConfigs?.[level];
        return (
          <MemberBadge
            key={level}
            level={level}
            size={size}
            showName={showName}
            showLevel={showLevel}
            customName={levelConfig?.customName}
            customLevel={levelConfig?.customLevel}
            onClick={onClick}
          />
        );
      })}
    </div>
  );
};

export default MemberBadgeGroup;