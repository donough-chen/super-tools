/**
 * 会员中心（积分成长体系总入口）
 *
 * 模块：等级卡 / 数据卡片 / 4 快捷入口 / 我的权益预览 / 今日任务（含签到） / 商城推荐
 *
 * Plan: Task 2.3
 */
import React, { useEffect, useMemo } from 'react';
import { showToast } from '../../utils/toast';
import { navigateTo } from '@/utils/navigator';
import {
  useUserStore,
  useMemberStore,
  useSignStore,
  useTaskStore,
  usePointsMallStore,
} from '../../store';
import AppHeader from '../../components/AppHeader';
import { MemberBadge } from '@/components/MemberBadge';
import { mapCodeToLevel, QUICK_ENTRIES } from '../../constants/member';
import { resolveIcon } from '../../utils/icon';
import type { TaskCategory } from '../../types/points';
import './index.less';

const MemberCenterPage: React.FC = () => {
  const { isLoggedIn, userInfo } = useUserStore();
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const signStatus = useSignStore((s) => s.status);
  const fetchSignStatus = useSignStore((s) => s.fetchStatus);
  const submitSign = useSignStore((s) => s.submitSign);
  const signSubmitting = useSignStore((s) => s.submitting);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const getTasksByCategory = useTaskStore((s) => s.getTasksByCategory);
  const mallItems = usePointsMallStore((s) => s.items);
  const fetchMallItems = usePointsMallStore((s) => s.fetchItems);

  useEffect(() => {
    if (!isLoggedIn) {
      navigateTo('/login');
      return;
    }
    fetchMemberInfo();
    fetchSignStatus();
    // 获取日常任务
    fetchTasks('daily' as TaskCategory, true);
    fetchMallItems();
  }, [isLoggedIn, fetchMemberInfo, fetchSignStatus, fetchTasks, fetchMallItems]);

  // 获取日常任务列表
  const dailyTasks = useMemo(
    () => getTasksByCategory('daily' as TaskCategory).slice(0, 3),
    [getTasksByCategory],
  );
  const recommendedItems = useMemo(() => mallItems.slice(0, 2), [mallItems]);

  const paid = memberInfo?.paid;
  const level = memberInfo?.level;
  const nextLevel = memberInfo?.nextLevel;
  const progressPercent = nextLevel
    ? Math.min(100, Math.round(nextLevel.progress * 100))
    : 100;

  const handleSign = async () => {
    try {
      const result = await submitSign();
      if (result) {
        showToast(`🎉 签到成功 +${result.pointsAwarded} 积分`, 'success');
      }
    } catch (e: any) {
      showToast(e?.message || '签到失败', 'error');
    }
  };

  return (
    <div className="page-member-center">
      <AppHeader
        title="会员中心"
        showBack
        onBack={() => navigateTo('/mine')}
        rightSlot={
          <span
            className="page-member-center__level-link"
            onClick={() => navigateTo('/member/level')}
          >
            等级详情
          </span>
        }
      />

      <main className="page-member-center__content">
        {/* 1. 顶部等级卡 */}
        <div
          className="page-member-center__hero"
          style={level?.color ? { '--member-center-hero-color': level.color } as React.CSSProperties : undefined}
          onClick={() => navigateTo('/member/level')}
        >
          <div className="page-member-center__hero-row">
            <img
              className="page-member-center__avatar"
              src={userInfo?.avatar || resolveIcon('/assets/icons/avatar.png')}
              alt="avatar"
            />
            <div className="page-member-center__hero-info">
              <div className="page-member-center__nickname">
                {userInfo?.nickname || userInfo?.username || '用户'}
              </div>
              <div className="page-member-center__hero-level">
                {level && (
                  <MemberBadge
                    level={mapCodeToLevel(level.code)}
                    size={42}
                    customName={level?.name || '普通用户'}
                    showLevel={false}
                  />
                )}
                {paid?.isPaid && (
                  <div className="page-member-center__paid-badge">
                    <p className="page-member-center__paid-badge-name">{paid.planName}</p>
                    <p className="page-member-center__paid-badge-expire">{paid.expireAt ? `有效期至 ${paid.expireAt.slice(0, 10)}` : '永久有效'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {nextLevel ? (
            <>
              <div className="page-member-center__progress-range">
                <span className="page-member-center__progress-range-start">
                  {level?.upgradeGrowth ?? 0}
                </span>
                <span className="page-member-center__progress-range-end">
                  {nextLevel.upgradeGrowth}
                </span>
              </div>
              <div className="page-member-center__progress">
                <div
                  className="page-member-center__progress-bar"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="page-member-center__progress-text">
                成长值 {memberInfo?.growthValue ?? 0}，距 {nextLevel.name} 还差 {nextLevel.remaining} 成长值
              </div>
            </>
          ) : (
            <div className="page-member-center__progress-text">
              ✨ 您已是最高等级，感谢您的长期支持
            </div>
          )}
        </div>

        {/* 2. 数据卡片 */}
        <div className="page-member-center__stats">
          <div
            className="page-member-center__stat"
            onClick={() => navigateTo('/member/points-logs')}
          >
            <div className="page-member-center__stat-value">
              {memberInfo?.points ?? 0}
            </div>
            <div className="page-member-center__stat-label">可用积分</div>
          </div>
          <div
            className="page-member-center__stat"
            onClick={() => navigateTo('/member/points-logs')}
          >
            <div className="page-member-center__stat-value">
              {memberInfo?.totalPoints ?? 0}
            </div>
            <div className="page-member-center__stat-label">累计积分</div>
          </div>
          <div
            className="page-member-center__stat"
            onClick={() => navigateTo('/tasks')}
          >
            <div className="page-member-center__stat-value">
              {signStatus?.continuousDays ?? 0}
            </div>
            <div className="page-member-center__stat-label">连签天数</div>
          </div>
        </div>

        {/* 3. 快捷入口 */}
        <div className="page-member-center__entries">
          {QUICK_ENTRIES.map((e) => (
            <div
              key={e.key}
              className="page-member-center__entry"
              onClick={() => navigateTo(e.path)}
            >
              <div className="page-member-center__entry-icon">{e.icon}</div>
              <div className="page-member-center__entry-label">{e.label}</div>
            </div>
          ))}
        </div>

        {/* 4. 我的权益（简版） */}
        <div className="page-member-center__section">
          <div className="page-member-center__section-title">我的权益</div>
          <div
            className="page-member-center__benefits"
            onClick={() => navigateTo('/member/level')}
          >
            <div className="page-member-center__benefits-text">
              {level
                ? `当前 ${level.name}，享受专属权益`
                : '登录后查看会员权益'}
            </div>
            <span className="page-member-center__more">查看全部权益</span>
          </div>
        </div>

        {/* 5. 今日任务（含签到） */}
        <div className="page-member-center__section">
          <div className="page-member-center__section-title">
            今日任务
            <span
              className="page-member-center__more"
              onClick={() => navigateTo('/tasks')}
            >
              全部
            </span>
          </div>

          <div className="page-member-center__sign">
            <div>
              <div className="page-member-center__sign-title">每日签到</div>
              <div className="page-member-center__sign-sub">
                {signStatus?.signedToday
                  ? `今日已签到 · 已连签 ${signStatus.continuousDays} 天`
                  : '签到可获得积分'}
              </div>
            </div>
            <button
              className="page-member-center__sign-btn"
              disabled={signStatus?.signedToday || signSubmitting}
              onClick={handleSign}
            >
              {signSubmitting
                ? '签到中...'
                : signStatus?.signedToday
                  ? '已签到'
                  : '签到'}
            </button>
          </div>

          {dailyTasks.length === 0 && (
            <div className="page-member-center__empty">暂无日常任务</div>
          )}
          {dailyTasks.map((t: any) => (
            <div
              key={t.code}
              className="page-member-center__task"
              onClick={() => navigateTo('/tasks')}
            >
              <div className="page-member-center__task-name">{t.name}</div>
              <div className="page-member-center__task-reward">
                +{t.rewardPoints} 积分
              </div>
            </div>
          ))}
        </div>

        {/* 6. 商城推荐 */}
        {recommendedItems.length > 0 && (
          <div className="page-member-center__section">
            <div className="page-member-center__section-title">
              积分商城推荐
              <span
                className="page-member-center__more"
                onClick={() => navigateTo('/points-mall')}
              >
                更多
              </span>
            </div>
            <div className="page-member-center__mall">
              {recommendedItems.map((it) => (
                <div
                  key={it.id}
                  className="page-member-center__mall-item"
                  onClick={() => navigateTo(`/points-mall/items/${it.id}`)}
                >
                  <img
                    className="page-member-center__mall-img"
                    src={it.images[0]}
                    alt={it.name}
                  />
                  <div className="page-member-center__mall-name">{it.name}</div>
                  <div className="page-member-center__mall-points">
                    {it.pointsActual ?? it.pointsRequired} 积分
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MemberCenterPage;
