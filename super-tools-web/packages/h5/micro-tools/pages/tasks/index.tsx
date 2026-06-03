/**
 * 任务中心
 *
 * 4 Tab：新手 / 日常 / 成就 / 活动
 * - 点击 Tab 时根据分类获取对应任务列表
 * - 日常 Tab 含签到日历
 * - 活动 Tab 展示截止时间
 *
 * Plan: Task 4.4
 */
import React, { useEffect, useMemo, useState } from 'react';
import { navigateTo, navigateBack } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import AppTabs from '../../components/AppTabs';
import SignCalendar from '../../components/SignCalendar';
import TaskCard from '../../components/TaskCard';
import { showToast } from '../../utils/toast';
import {
  useMemberStore, useSignStore, useTaskStore,
} from '../../store';
import { resolveTaskJumpPath } from '../../constants/taskJumpMap';
import type { TaskCategory, TaskItem } from '../../types/points';
import './index.less';

interface TabConfig {
  key: TaskCategory;
  name: string;
}

const TAB_CONFIGS: TabConfig[] = [
  { key: 'newbie', name: '🌱 新手' },
  { key: 'daily', name: '📅 日常' },
  { key: 'achievement', name: '🏆 成就' },
  { key: 'activity', name: '🎪 活动' },
];

const TaskCenterPage: React.FC = () => {
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const signStatus = useSignStore((s) => s.status);
  const fetchSignStatus = useSignStore((s) => s.fetchStatus);
  const submitSign = useSignStore((s) => s.submitSign);
  const signSubmitting = useSignStore((s) => s.submitting);
  
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const claimTask = useTaskStore((s) => s.claimTask);
  const claimingCode = useTaskStore((s) => s.claimingCode);
  const getTasksByCategory = useTaskStore((s) => s.getTasksByCategory);
  const loading = useTaskStore((s) => s.loading);

  const [activeTabIdx, setActiveTabIdx] = useState(1); // 默认日常

  const activeCategory = TAB_CONFIGS[activeTabIdx]?.key || 'daily';
  const currentTasks = getTasksByCategory(activeCategory);

  // 初始化：获取会员信息和签到状态
  useEffect(() => {
    fetchMemberInfo();
    fetchSignStatus();
  }, [fetchMemberInfo, fetchSignStatus]);

  // Tab 切换时获取对应分类的任务
  useEffect(() => {
    fetchTasks(activeCategory, true);
  }, [activeCategory, fetchTasks]);

  // 头部统计（基于当前分类的任务）
  const todayPointsGain = useMemo(() => {
    return currentTasks
      .filter((t) => t.status === 'claimed')
      .reduce((sum, t) => sum + t.rewardPoints, 0);
  }, [currentTasks]);

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

  const handleJump = (path: string) => navigateTo(path);

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
    if (loading) {
      return <div className="page-tasks__loading">加载中...</div>;
    }

    if (activeCategory === 'newbie') {
      const completedCount = currentTasks.filter(
        (t) => t.status === 'claimed' || t.status === 'completed',
      ).length;
      const percent =
        currentTasks.length === 0
          ? 0
          : Math.round((completedCount / currentTasks.length) * 100);
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
              完成进度 {completedCount} / {currentTasks.length}
            </div>
          </div>
          {currentTasks.length === 0 ? (
            <EmptyState text="暂无新手任务" />
          ) : (
            currentTasks.map((t) => (
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

    if (activeCategory === 'daily') {
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
          {currentTasks.length === 0 ? (
            <EmptyState text="暂无每日任务" />
          ) : (
            currentTasks.map((t) => (
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

    if (activeCategory === 'achievement') {
      // 按 category 子分组（后端返回的 category 可能更细）
      const bySubCategory: Record<string, TaskItem[]> = {};
      for (const t of currentTasks) {
        const c = t.category || 'other';
        if (!bySubCategory[c]) bySubCategory[c] = [];
        bySubCategory[c].push(t);
      }
      return (
        <div className="page-tasks__panel">
          {currentTasks.length === 0 ? (
            <EmptyState text="暂无成就任务" />
          ) : (
            Object.entries(bySubCategory).map(([cat, list]) => (
              <React.Fragment key={cat}>
                <div className="page-tasks__section-title">成就任务</div>
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
    return (
      <div className="page-tasks__panel">
        {currentTasks.length === 0 ? (
          <EmptyState text="🎪 暂无进行中的活动" />
        ) : (
          currentTasks.map((t) => (
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
      <AppHeader title="任务中心" showBack onBack={() => navigateBack()} />

      <main className="page-tasks__content">
        {/* 顶部头条 */}
        <div className="page-tasks__header-stats">
          <div>
            <div className="page-tasks__stat-num">+{todayPointsGain}</div>
            <div className="page-tasks__stat-label">今日已得积分</div>
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
