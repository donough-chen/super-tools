import React from 'react';
import { Progress, Tag, Empty } from 'antd';
import { MemberStats, MemberLevel } from '@/services/member';
import { levelColor } from '@/utils/memberFormat';

interface Props {
  stats: MemberStats | null;
  levels: MemberLevel[];
}

const LevelDistribution: React.FC<Props> = ({ stats, levels }) => {
  if (!stats || !levels.length) return <Empty description="暂无数据" />;

  const dist = stats.levelDistribution || {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  // 按 level ASC 排序，确保展示顺序与等级层次一致
  const sortedLevels = [...levels].sort((a, b) => a.level - b.level);

  return (
    <div className="level-distribution">
      {sortedLevels.map((lv) => {
        const cnt = dist[lv.code] || 0;
        const pct = (cnt / total) * 100;
        const color = levelColor(lv.color);
        return (
          <div key={lv.code} className="level-row">
            <div className="level-name">
              <Tag color={color}>{lv.name}</Tag>
            </div>
            <div className="level-bar">
              <Progress
                percent={pct}
                strokeColor={color}
                format={() => `${cnt} (${pct.toFixed(1)}%)`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LevelDistribution;
