/**
 * 等级详情页
 *
 * 展示：等级时间轴 / 当前+下一级权益对比 / 升级激励文案
 *
 * Plan: Task 3.1
 */
import React, { useEffect, useMemo, useState } from 'react';
import { history } from 'umi';
import AppHeader from '../../../components/AppHeader';
import { useMemberStore } from '../../../store';
import { getMemberLevels, getMemberBenefits } from '../../../service/member';
import type { MemberLevelItem, MemberBenefitsResponse } from '../../../types/points';
import './index.less';

const BENEFIT_KEY_LABELS: Record<string, string> = {
  points_multiplier: '消费积分倍率',
  points_expire_days: '积分有效期（天）',
  discount: '商城折扣',
  daily_sign_points: '每日签到积分',
  upgrade_gift_points: '升级礼包积分',
  deduct_limit: '抵扣上限',
  max_devices: '最多设备数',
  ad_free: '免广告',
  priority_support: '优先客服',
  exclusive_content: '专属内容',
  monthly_coupon: '每月优惠券',
};

const LevelPage: React.FC = () => {
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const [levels, setLevels] = useState<MemberLevelItem[]>([]);
  const [benefits, setBenefits] = useState<MemberBenefitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevelCode, setSelectedLevelCode] = useState<string | null>(null);

  useEffect(() => {
    fetchMemberInfo();
    Promise.all([getMemberLevels(), getMemberBenefits()])
      .then(([lvRes, bfRes]: any[]) => {
        if (lvRes?.code === 200 && lvRes.data) {
          setLevels(
            (lvRes.data as MemberLevelItem[]).sort((a, b) => a.level - b.level),
          );
        }
        if (bfRes?.code === 200 && bfRes.data) {
          setBenefits(bfRes.data);
        }
      })
      .finally(() => setLoading(false));
  }, [fetchMemberInfo]);

  const currentLevel = memberInfo?.level;
  const nextLevel = memberInfo?.nextLevel;

  // 升级激励文案分档
  const upgradeText = useMemo(() => {
    if (!nextLevel) return '✨ 您已是最高等级，感谢您的长期支持';
    const remaining = nextLevel.remaining;
    if (remaining <= 200) return `再消费 ${remaining} 元即可升级！冲刺一下～`;
    if (remaining <= 1000) return `距升级还差 ${remaining} 成长值，继续加油！`;
    return `距升级还差 ${remaining} 成长值，预计消费 ${remaining} 元`;
  }, [nextLevel]);

  // 选中等级（默认当前等级）
  const selectedLevel = useMemo(() => {
    const code = selectedLevelCode || currentLevel?.code;
    return levels.find((l) => l.code === code) || null;
  }, [selectedLevelCode, currentLevel, levels]);

  const isLocked = (lv: MemberLevelItem) => {
    if (!currentLevel) return true;
    return lv.level > currentLevel.level;
  };

  if (loading) {
    return (
      <div className="page-level">
        <AppHeader title="会员等级" showBack onBack={() => history.goBack()} />
        <div className="page-level__loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="page-level">
      <AppHeader title="会员等级" showBack onBack={() => history.goBack()} />

      <main className="page-level__content">
        {/* 顶部：当前等级标识 */}
        <div className="page-level__hero">
          <div className="page-level__hero-icon">
            {currentLevel?.icon || '🥇'}
          </div>
          <div className="page-level__hero-name">
            {currentLevel?.name || '普通用户'}
          </div>
          <div className="page-level__hero-growth">
            成长值 {memberInfo?.growthValue ?? 0}
          </div>
        </div>

        {/* 等级时间轴 */}
        <div className="page-level__timeline">
          {levels.map((lv, idx) => (
            <React.Fragment key={lv.code}>
              <div
                className={`page-level__node${
                  currentLevel && lv.level <= currentLevel.level
                    ? ' is-reached'
                    : ''
                }${selectedLevel?.code === lv.code ? ' is-selected' : ''}`}
                onClick={() => setSelectedLevelCode(lv.code)}
              >
                <div className="page-level__node-dot" />
                <div className="page-level__node-name">{lv.name}</div>
                <div className="page-level__node-growth">{lv.upgradeGrowth}</div>
              </div>
              {idx < levels.length - 1 && <div className="page-level__line" />}
            </React.Fragment>
          ))}
        </div>

        {/* 升级激励文案 */}
        <div className="page-level__upgrade-text">{upgradeText}</div>

        {/* 选中等级权益详情 */}
        {selectedLevel && (
          <div className="page-level__section">
            <div className="page-level__section-title">
              {selectedLevel.name} 权益
              {isLocked(selectedLevel) && (
                <span className="page-level__locked-badge">🔒 未解锁</span>
              )}
            </div>
            <BenefitsList
              benefits={selectedLevel.benefits}
              locked={isLocked(selectedLevel)}
            />
          </div>
        )}

        {/* 当前 vs 下一级对比 */}
        {benefits?.benefitsDiff && benefits.benefitsDiff.length > 0 && (
          <div className="page-level__section">
            <div className="page-level__section-title">
              权益对比（当前 vs 下一级）
            </div>
            {benefits.benefitsDiff.map((d) => (
              <div key={d.key} className="page-level__diff-row">
                <div className="page-level__diff-name">{d.name}</div>
                <div className="page-level__diff-values">
                  <span className="page-level__diff-current">
                    {String(d.currentValue)}
                  </span>
                  <span className="page-level__diff-arrow">→</span>
                  <span
                    className={`page-level__diff-next${
                      d.locked ? ' is-locked' : ''
                    }`}
                  >
                    {String(d.nextValue)} {d.locked && '🔒'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

/** 权益项展示 */
const BenefitsList: React.FC<{
  benefits: Record<string, any> | null;
  locked: boolean;
}> = ({ benefits, locked }) => {
  if (!benefits) {
    return <div className="page-level__empty">暂无权益数据</div>;
  }
  const entries = Object.entries(benefits).filter(
    ([k]) => BENEFIT_KEY_LABELS[k],
  );
  if (entries.length === 0) {
    return <div className="page-level__empty">暂无权益数据</div>;
  }
  return (
    <div className={`page-level__benefits${locked ? ' is-locked' : ''}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="page-level__benefit">
          <span className="page-level__benefit-icon">
            {locked ? '🔒' : '✓'}
          </span>
          <span className="page-level__benefit-name">
            {BENEFIT_KEY_LABELS[k]}
          </span>
          <span className="page-level__benefit-value">{String(v)}</span>
        </div>
      ))}
    </div>
  );
};

export default LevelPage;
