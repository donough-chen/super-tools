/**
 * 任务中心
 *
 * 4 Tab：新手 / 日常 / 成长 / 活动
 *  - 日常 Tab 含签到日历
 *  - 成长 Tab 按 category 分组
 *  - 活动 Tab 展示截止时间
 *
 * Plan: Task 4.4
 */
import React, { useEffect, useMemo, useState } from 'react';
import { history } from 'umi';
import AppHeader from '../../components/AppHeader';
import AppTabs from '../../components/AppTabs';
import SignCalendar from '../../components/SignCalendar';
import TaskCard from '../../components/TaskCard';
import { showToast } from '../../utils/toast';
import { safeNavigate } from '../../utils/safeNavigate';
import {
  useMemberStore,
  useSignStore,
  useTaskStore,
  selectGroupedTasks,
} from '../../store';
import { resolveTaskJumpPath } from '../../constants/taskJumpMap';
import type { TaskItem, TaskType } from '../../types/points';
import './index.less';

interface TabConfig {
  key: TaskType;
  name: string;
  icon: string;
}

const TAB_CONFIGS: TabConfig[] = [
  { key: 'new_user', name: '🌱 新手', icon: '' },
  { key: 'daily', name: '📅 日常', icon: '' },
  { key: 'milestone', name: '🏆 成长', icon: '' },
  { key: 'activity', name: '🎪 活动', icon: '' },
];

const MILESTONE_LABELS: Record<string, string> = {
  consume: '消费里程碑',
  sign: '签到里程碑',
  invite: '邀请里程碑',
};

const TaskCenterPage: React.FC = () => {
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const signStatus = useSignStore((s) => s.status);
  const fetchSignStatus = useSignStore((s) => s.fetchStatus);
  const submitSign = useSignStore((s) => s.submitSign);
  const signSubmitting = useSignStore((s) => s.submitting);
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const claimTask = useTaskStore((s) => s.claimTask);
  const claimingCode = useTaskStore((s) => s.claimingCode);

  const [activeTabIdx, setActiveTabIdx] = useState(1); // 默认日常

  useEffect(() => {
    fetchMemberInfo();
    fetchSignStatus();
    fetchTasks();
  }, [fetchMemberInfo, fetchSignStatus, fetchTasks]);

  const grouped = useMemo(() => selectGroupedTasks(tasks), [tasks]);
  const activeKey = TAB_CONFIGS[activeTabIdx]?.key || 'daily';

  // 头部统计
  const todayPointsGain = useMemo(() => {
    return grouped.daily
      .filter((t) => t.status === 'claimed')
      .reduce((sum, t) => sum + t.rewardPoints, 0);
  }, [grouped]);
  const weeklyDone = useMemo(() => {
    return grouped.weekly.filter(
      (t) => t.status === 'claimed' || t.status === 'completed',
    ).length;
  }, [grouped]);
  const weeklyTotal = grouped.weekly.length;

  const handleClaim = async (code: string) => {
    try {
      const result = await claimTask(code);
      if (result) {
        showToast(`🎉 +${result.pointsAwarded} 积分`, 'success');
      }
    } catch (e: any) {
      showToast(e?.message || '领取失败', 'error');
    }
  };

  const handleJump = (path: string) => safeNavigate(path);

  const handleSign = async () => {
    try {
      const result = await submitSign();
      if (result) {
        showToast(
          `🎉 签到成功 +${result.pointsAwarded} 积分`,
          'success',
        );
      }
    } catch (e: any) {
      showToast(e?.message || '签到失败', 'error');
    }
  };

  const enrichJump = (t: TaskItem): TaskItem => ({
    ...t,
    jumpPath: resolveTaskJumpPath(t),
  });

  // 渲染各 Tab 内容
  const renderTab = () => {
    if (activeKey === 'new_user') {
      const list = grouped.new_user;
      const completedCount = list.filter(
        (t) => t.status === 'claimed' || t.status === 'completed',
      ).length;
      const percent =
        list.length === 0
          ? 0
          : Math.round((completedCount / list.length) * 100);
      return (
        <div className="page-tasks__panel">
          <div className="page-tasks__hero">
            <div className="page-tasks__hero-title">🌱 新手任务</div>
            <div className="page-tasks__hero-sub">
              完成全部任务，额外奖励多多
            </div>
            <div className="page-tasks__progress-bar">
              <div
                className="page-tasks__progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="page-tasks__progress-text">
              完成进度 {completedCount} / {list.length}
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState text="暂无新手任务" />
          ) : (
            list.map((t) => (
              <TaskCard
                key={t.code}
                task={enrichJump(t)}
                onClaim={handleClaim}
                onJump={handleJump}
                claiming={claimingCode === t.code}
              />
            ))
          )}
        </div>
      );
    }

    if (activeKey === 'daily') {
      const dailyList = grouped.daily;
      const weeklyList = grouped.weekly;
      return (
        <div className="page-tasks__panel">
          <div className="page-tasks__section-title">每日签到</div>
          <SignCalendar
            weekData={signStatus?.weekCalendar || []}
            continuousDays={signStatus?.continuousDays || 0}
            signedToday={signStatus?.signedToday}
            submitting={signSubmitting}
            onSign={handleSign}
          />

          <div className="page-tasks__section-title">每日任务</div>
          {dailyList.length === 0 ? (
            <EmptyState text="暂无每日任务" />
          ) : (
            dailyList.map((t) => (
              <TaskCard
                key={t.code}
                task={enrichJump(t)}
                onClaim={handleClaim}
                onJump={handleJump}
                claiming={claimingCode === t.code}
              />
            ))
          )}

          {weeklyList.length > 0 && (
            <>
              <div className="page-tasks__section-title">每周任务</div>
              {weeklyList.map((t) => (
                <TaskCard
                  key={t.code}
                  task={enrichJump(t)}
                  onClaim={handleClaim}
                  onJump={handleJump}
                  claiming={claimingCode === t.code}
                />
              ))}
            </>
          )}
        </div>
      );
    }

    if (activeKey === 'milestone') {
      const milestones = grouped.milestone;
      const byCategory: Record<string, TaskItem[]> = {};
      for (const t of milestones) {
        const c = t.category || 'other';
        if (!byCategory[c]) byCategory[c] = [];
        byCategory[c].push(t);
      }
      return (
        <div className="page-tasks__panel">
          {milestones.length === 0 ? (
            <EmptyState text="暂无成长任务" />
          ) : (
            Object.entries(byCategory).map(([cat, list]) => (
              <React.Fragment key={cat}>
                <div className="page-tasks__section-title">
                  {MILESTONE_LABELS[cat] || '其他里程碑'}
                </div>
                {list.map((t) => (
                  <TaskCard
                    key={t.code}
                    task={enrichJump(t)}
                    onClaim={handleClaim}
                    onJump={handleJump}
                    claiming={claimingCode === t.code}
                  />
                ))}
              </React.Fragment>
            ))
          )}
        </div>
      );
    }

    // activity
    const activities = grouped.activity;
    return (
      <div className="page-tasks__panel">
        {activities.length === 0 ? (
          <EmptyState text="🎪 暂无进行中的活动" />
        ) : (
          activities.map((t) => (
            <div key={t.code}>
              {t.expireAt && (
                <div className="page-tasks__activity-meta">
                  截止：{t.expireAt.slice(0, 10)}
                </div>
              )}
              <TaskCard
                task={enrichJump(t)}
                onClaim={handleClaim}
                onJump={handleJump}
                claiming={claimingCode === t.code}
              />
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="page-tasks">
      <AppHeader title="任务中心" showBack onBack={() => history.goBack()} />

      <main className="page-tasks__content">
        {/* 顶部头条 */}
        <div className="page-tasks__header-stats">
          <div>
            <div className="page-tasks__stat-num">+{todayPointsGain}</div>
            <div className="page-tasks__stat-label">今日已得积分</div>
          </div>
          <div>
            <div className="page-tasks__stat-num">
              {weeklyDone} / {weeklyTotal}
            </div>
            <div className="page-tasks__stat-label">本周完成</div>
          </div>
          <div>
            <div className="page-tasks__stat-num">
              {memberInfo?.points ?? 0}
            </div>
            <div className="page-tasks__stat-label">可用积分</div>
          </div>
        </div>

        {/* 4 Tab */}
        <AppTabs
          mode="multiple"
          tabs={TAB_CONFIGS.map((t) => ({ key: t.key, name: t.name }))}
          activeIndex={activeTabIdx}
          onChange={(idx: number) => setActiveTabIdx(idx)}
        />

        {renderTab()}
      </main>
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="page-tasks__empty">{text}</div>
);

export default TaskCenterPage;
