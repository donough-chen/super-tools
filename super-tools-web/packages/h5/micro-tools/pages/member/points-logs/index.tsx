/**
 * 积分明细页
 *
 * 模块：顶部汇总卡 / 即将过期提醒 / 类型筛选 / 时间筛选 / 按月分组列表 / 分页加载
 *
 * Plan: Task 3.2
 */
import React, { useEffect, useMemo, useState } from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import { useMemberStore, usePointsLogStore } from '../../../store';
import type { PointsLog, PointsLogType } from '../../../types/points';
import type { DateRangeKey } from '../../../store/pointsLog';
import './index.less';

const TYPE_LABELS: Record<PointsLogType, string> = {
  sign: '每日签到',
  consume_reward: '消费返积分',
  task: '任务奖励',
  mall_exchange: '积分商城兑换',
  expired: '积分过期',
  admin_adjust: '系统调整',
  refund: '退款',
  other: '其他',
};

const FILTER_TABS: Array<{
  key: 'all' | 'gain' | 'consume' | 'expired';
  label: string;
}> = [
  { key: 'all', label: '全部' },
  { key: 'gain', label: '获得' },
  { key: 'consume', label: '消耗' },
  { key: 'expired', label: '过期' },
];

const RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'last3Months', label: '近3月' },
  { key: 'all', label: '全部' },
];

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const PointsLogsPage: React.FC = () => {
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const { logs, loading, hasMore, filter, fetchLogs, setFilter, loadMore } =
    usePointsLogStore();
  const [activeTab, setActiveTab] = useState<
    'all' | 'gain' | 'consume' | 'expired'
  >('all');
  const [showRange, setShowRange] = useState(false);

  useEffect(() => {
    fetchMemberInfo();
    fetchLogs(true);
  }, [fetchMemberInfo, fetchLogs]);

  // Tab 切换（不传 type 给后端，纯前端筛选避免后端 type 解析问题）
  const handleTab = (key: 'all' | 'gain' | 'consume' | 'expired') => {
    setActiveTab(key);
    // 始终用 type='all' 拉全量数据，前端 displayLogs 做客户端过滤
    if (filter.type !== 'all') {
      setFilter({ type: 'all' });
    }
  };

  // 时间切换
  const handleRange = (range: DateRangeKey) => {
    setShowRange(false);
    setFilter({ range });
  };

  // 按 Tab 前端过滤（gain/consume 是在"全部"数据上做 client-side 过滤）
  const displayLogs = useMemo(() => {
    if (activeTab === 'all') return logs;
    if (activeTab === 'gain') return logs.filter((l) => l.points > 0);
    if (activeTab === 'consume')
      return logs.filter((l) => l.points < 0 && l.type !== 'expired');
    if (activeTab === 'expired') return logs.filter((l) => l.type === 'expired');
    return logs;
  }, [logs, activeTab]);

  // 即将过期（30 天内）
  const expiringLogs = useMemo(() => {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 3600 * 1000;
    return logs
      .filter((l) => l.expireAt && l.points > 0)
      .filter((l) => {
        const t = new Date(l.expireAt!).getTime();
        return t > now && t - now <= THIRTY_DAYS;
      })
      .slice(0, 3);
  }, [logs]);

  // 按月分组
  const groupedLogs = useMemo(() => {
    const groups: Record<string, PointsLog[]> = {};
    for (const l of displayLogs) {
      const d = new Date(l.createdAt);
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    }
    return groups;
  }, [displayLogs]);

  // 本月汇总
  const monthSummary = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let gain = 0;
    let consume = 0;
    let expiring = 0;
    for (const l of logs) {
      const d = new Date(l.createdAt);
      if (d.getFullYear() === y && d.getMonth() === m) {
        if (l.points > 0) gain += l.points;
        if (l.points < 0 && l.type !== 'expired') consume += -l.points;
      }
      if (l.expireAt && l.points > 0) {
        const t = new Date(l.expireAt).getTime();
        const diff = t - Date.now();
        if (diff > 0 && diff <= 30 * 24 * 3600 * 1000) expiring += l.points;
      }
    }
    return { gain, consume, expiring };
  }, [logs]);

  // 滚动到底部加载更多
  useEffect(() => {
    const onScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } =
        document.documentElement;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        loadMore();
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  return (
    <div className="page-points-logs">
      <AppHeader title="积分明细" showBack onBack={() => navigateBack()} />

      <main className="page-points-logs__content">
        {/* 顶部汇总卡 */}
        <div className="page-points-logs__summary">
          <div className="page-points-logs__summary-main">可用积分</div>
          <div className="page-points-logs__summary-points">
            {memberInfo?.points ?? 0}
          </div>
          <div className="page-points-logs__summary-row">
            <div>
              <div className="page-points-logs__summary-num gain">
                +{monthSummary.gain}
              </div>
              <div className="page-points-logs__summary-label">本月获得</div>
            </div>
            <div>
              <div className="page-points-logs__summary-num consume">
                -{monthSummary.consume}
              </div>
              <div className="page-points-logs__summary-label">本月消耗</div>
            </div>
            <div>
              <div className="page-points-logs__summary-num expire">
                {monthSummary.expiring}
              </div>
              <div className="page-points-logs__summary-label">即将过期</div>
            </div>
          </div>
        </div>

        {/* 即将过期提醒 */}
        {expiringLogs.length > 0 && (
          <div className="page-points-logs__expiring">
            <div className="page-points-logs__expiring-title">即将过期</div>
            {expiringLogs.map((l) => {
              const t = new Date(l.expireAt!);
              const days = Math.ceil(
                (t.getTime() - Date.now()) / (24 * 3600 * 1000),
              );
              return (
                <div key={l.id} className="page-points-logs__expiring-item">
                  <div className="page-points-logs__expiring-points">
                    ⚠️ {l.points} 积分将于 {t.toISOString().slice(0, 10)} 过期
                  </div>
                  <div className="page-points-logs__expiring-sub">
                    距今 {days} 天 · {l.description}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 筛选 Tab + 时间下拉 */}
        <div className="page-points-logs__filter">
          <div className="page-points-logs__tabs">
            {FILTER_TABS.map((t) => (
              <span
                key={t.key}
                className={`page-points-logs__tab${
                  activeTab === t.key ? ' is-active' : ''
                }`}
                onClick={() => handleTab(t.key)}
              >
                {t.label}
              </span>
            ))}
          </div>
          <div
            className="page-points-logs__range"
            onClick={() => setShowRange((s) => !s)}
          >
            {RANGE_OPTIONS.find((r) => r.key === filter.range)?.label} ▾
            {showRange && (
              <div className="page-points-logs__range-menu">
                {RANGE_OPTIONS.map((r) => (
                  <div
                    key={r.key}
                    className={`page-points-logs__range-item${
                      filter.range === r.key ? ' is-active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRange(r.key);
                    }}
                  >
                    {r.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 列表 */}
        {displayLogs.length === 0 && !loading && (
          <div className="page-points-logs__empty">
            💰 还没有积分记录
            <div className="page-points-logs__empty-sub">
              完成任务或消费即可获得积分
            </div>
          </div>
        )}

        {Object.entries(groupedLogs).map(([month, items]) => (
          <div key={month} className="page-points-logs__group">
            <div className="page-points-logs__group-title">— {month} —</div>
            {items.map((l) => (
              <LogItem key={l.id} log={l} />
            ))}
          </div>
        ))}

        {loading && (
          <div className="page-points-logs__loading">加载中...</div>
        )}
        {!hasMore && displayLogs.length > 0 && (
          <div className="page-points-logs__end">已显示全部记录</div>
        )}
      </main>
    </div>
  );
};

const LogItem: React.FC<{ log: PointsLog }> = ({ log }) => {
  const isExpired = log.type === 'expired';
  const isPositive = log.points > 0;
  const colorClass = isExpired
    ? 'is-expired'
    : isPositive
      ? 'is-gain'
      : 'is-consume';
  const icon = isExpired ? '⚠️' : isPositive ? '🟢' : '🔴';

  // 优先显示 description（后端 remark），标题用类型标签兜底
  const title = log.description || TYPE_LABELS[log.type] || log.type;

  return (
    <div className="page-points-logs__item">
      <div className="page-points-logs__item-left">
        <div className="page-points-logs__item-title">
          {icon} {title}
        </div>
        {/* description 与类型标签不同时才显示副标题，避免重复 */}
        {log.description && log.description !== TYPE_LABELS[log.type] && (
          <div className="page-points-logs__item-desc">{log.description}</div>
        )}
      </div>
      <div className="page-points-logs__item-right">
        <div className={`page-points-logs__item-points ${colorClass}`}>
          {log.points > 0 ? `+${log.points}` : log.points}
        </div>
        <div className="page-points-logs__item-time">
          {formatDate(log.createdAt)}
        </div>
      </div>
    </div>
  );
};

export default PointsLogsPage;
