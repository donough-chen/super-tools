/**
 * 个人信息页（重构）
 *
 * 5 大卡片：
 *  1) 头像（V1：URL 输入弹窗；V2：上传组件）
 *  2) 基础资料：昵称 / 性别 / 生日
 *  3) 个人介绍：bio / signature / regionCode / language / timezone
 *  4) 我的会员（点击跳 /member）
 *  5) 我的邀请码（一键复制）
 *
 * 数据流：
 *  - 入口：并行 fetchProfile() + fetchMemberInfo()
 *  - 编辑：本地 useState + dirtyFields Set 跟踪改动
 *  - 保存：右上角按钮（dirty 时高亮），仅提交变更字段
 *  - 离开：dirty > 0 时 AppModal 二次确认
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'umi';
import { navigateTo, navigateBack } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import AppModal from '../../components/AppModal';
import { useUserStore, useMemberStore } from '../../store';
import {
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  findOptionLabel,
} from '../../constants/options';
import { showToast, copyToClipboard } from '../../utils/toast';
import type { UpdateProfileDTO } from '../../types/auth';
import './index.less';

// 表单字段类型（仅包含 profile 页可编辑字段）
type EditableKey =
  | 'nickname' | 'avatar' | 'gender' | 'birthday'
  | 'bio' | 'signature' | 'regionCode' | 'language' | 'timezone';

interface FormValues {
  nickname: string;
  avatar: string;
  gender: 0 | 1 | 2;
  birthday: string;
  bio: string;
  signature: string;
  regionCode: string;
  language: string;
  timezone: string;
}

const EMPTY_VALUES: FormValues = {
  nickname: '', avatar: '', gender: 0, birthday: '',
  bio: '', signature: '', regionCode: '', language: 'zh-CN', timezone: 'Asia/Shanghai',
};

const ProfilePage: React.FC = () => {
  const location = useLocation();
  const fromRegister = (location as any).query?.from === 'register';

  const { userInfo, profileExtra, fetchProfile, updateProfile } = useUserStore();
  const { memberInfo, fetchMemberInfo } = useMemberStore();

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [dirtyFields, setDirtyFields] = useState<Set<EditableKey>>(new Set());
  const [saving, setSaving] = useState(false);
  // 离开确认
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  // 头像编辑弹窗
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [avatarInput, setAvatarInput] = useState('');
  // 语言/时区单选弹窗
  const [optionModal, setOptionModal] = useState<null | { key: 'language' | 'timezone' }>(null);
  // 性别选择弹窗
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  // 同步 store → 本地表单（仅当用户尚未做编辑时）
  const syncedRef = useRef(false);
  useEffect(() => {
    fetchProfile();
    fetchMemberInfo();
    // 仅 mount 拉取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userInfo) return;
    if (syncedRef.current && dirtyFields.size > 0) return; // 用户已编辑，不覆盖
    setValues({
      nickname: userInfo.nickname || '',
      avatar: userInfo.avatar || '',
      gender: (userInfo.gender ?? 0) as 0 | 1 | 2,
      birthday: userInfo.birthday || '',
      bio: profileExtra?.bio || '',
      signature: profileExtra?.signature || '',
      regionCode: profileExtra?.regionCode || '',
      language: profileExtra?.language || 'zh-CN',
      timezone: profileExtra?.timezone || 'Asia/Shanghai',
    });
    syncedRef.current = true;
  }, [userInfo, profileExtra]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = useCallback(<K extends EditableKey>(key: K, value: FormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setDirtyFields(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const isDirty = dirtyFields.size > 0;

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    // 字段级校验
    if (values.nickname.trim().length > 50) { showToast('昵称不能超过 50 字', 'error'); return; }
    if (values.bio.length > 200) { showToast('个人简介不能超过 200 字', 'error'); return; }
    if (values.signature.length > 100) { showToast('个性签名不能超过 100 字', 'error'); return; }

    const dto: UpdateProfileDTO = {};
    dirtyFields.forEach((key) => {
      // 类型断言略
      (dto as any)[key] = (values as any)[key];
    });
    setSaving(true);
    const res = await updateProfile(dto);
    setSaving(false);
    if (res.success) {
      showToast(res.message || '保存成功', 'success');
      setDirtyFields(new Set());
    } else {
      showToast(res.message || '保存失败', 'error');
    }
  }, [isDirty, saving, values, dirtyFields, updateProfile]);

  /** 拦截后退：dirty 时弹确认 */
  const tryNavigate = useCallback((next: () => void) => {
    if (isDirty) {
      setPendingNav(() => next);
    } else {
      next();
    }
  }, [isDirty]);

  const handleBack = () => tryNavigate(() => navigateBack());
  const handleGotoMember = () => tryNavigate(() => navigateTo('/member'));

  // ==== 头像编辑 ====
  const openAvatarModal = () => {
    setAvatarInput(values.avatar);
    setAvatarModalVisible(true);
  };
  const confirmAvatar = () => {
    setField('avatar', avatarInput.trim());
    setAvatarModalVisible(false);
  };

  // ==== 邀请码复制 ====
  const handleCopyReferral = async () => {
    const code = profileExtra?.referralCode;
    if (!code) { showToast('暂无邀请码', 'info'); return; }
    const ok = await copyToClipboard(code);
    showToast(ok ? '邀请码已复制' : '复制失败', ok ? 'success' : 'error');
  };

  // ==== 选项弹窗 ====
  const optionsForModal = useMemo(() => {
    if (!optionModal) return [];
    return optionModal.key === 'language' ? LANGUAGE_OPTIONS : TIMEZONE_OPTIONS;
  }, [optionModal]);

  const memberLabel = memberInfo?.level?.name || '加载中...';
  const memberPoints = memberInfo?.points ?? 0;
  const memberProgress = memberInfo?.nextLevel?.progress ?? 0;
  const memberRemaining = memberInfo?.nextLevel?.remaining ?? 0;
  const nextLevelName = memberInfo?.nextLevel?.name || '';
  const isMaxLevel = memberInfo && !memberInfo.nextLevel;
  const memberColor = memberInfo?.level?.color || '#1677ff';
  const isPaid = memberInfo?.paid?.isPaid;
  const paidLabel = isPaid
    ? `${memberInfo?.paid?.planName || ''}${memberInfo?.paid?.remainingDays != null ? ` · ${memberInfo.paid.remainingDays}天后到期` : ''}`
    : '';

  // 右上角保存按钮
  const rightSlot = (
    <button
      type="button"
      className={`page-profile__save ${isDirty ? 'page-profile__save--active' : ''}`}
      disabled={!isDirty || saving}
      onClick={handleSave}
    >
      {saving ? '保存中' : '保存'}
    </button>
  );

  return (
    <div className="page-profile">
      <AppHeader
        title="个人信息"
        showBack
        onBack={handleBack}
        rightSlot={rightSlot}
      />
      <main className="page-profile__content">
        {fromRegister && (
          <div className="page-profile__welcome">
            欢迎加入 Super Tools 👋 完善资料让我们更好地为你服务
          </div>
        )}

        {/* 卡片 1：头像 */}
        <section className="profile-card profile-card--avatar">
          <button
            type="button"
            className="profile-card__avatar-btn"
            onClick={openAvatarModal}
            aria-label="修改头像"
          >
            <img
              className="profile-card__avatar-img"
              src={values.avatar || 'https://via.placeholder.com/160?text=头像'}
              alt="头像"
            />
            <span className="profile-card__avatar-tip">点击修改</span>
          </button>
        </section>

        {/* 卡片 2：基础资料 */}
        <section className="profile-card">
          <div className="profile-card__title">基础资料</div>

          <label className="profile-row">
            <span className="profile-row__label">昵称</span>
            <input
              className="profile-row__input"
              type="text"
              maxLength={50}
              placeholder="请输入昵称"
              value={values.nickname}
              onChange={e => setField('nickname', e.target.value)}
            />
          </label>

          <button
            type="button"
            className="profile-row profile-row--clickable"
            onClick={() => setGenderModalVisible(true)}
          >
            <span className="profile-row__label">性别</span>
            <span className="profile-row__value">
              {findOptionLabel(GENDER_OPTIONS, values.gender)}
              <span className="profile-row__arrow">›</span>
            </span>
          </button>

          <label className="profile-row">
            <span className="profile-row__label">生日</span>
            <input
              className="profile-row__input profile-row__input--date"
              type="date"
              value={values.birthday}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setField('birthday', e.target.value)}
            />
          </label>
        </section>

        {/* 卡片 3：个人介绍 */}
        <section className="profile-card">
          <div className="profile-card__title">个人介绍</div>

          <label className="profile-row profile-row--column">
            <span className="profile-row__label">个人简介</span>
            <textarea
              className="profile-row__textarea"
              maxLength={200}
              placeholder="介绍一下你自己（最多 200 字）"
              value={values.bio}
              onChange={e => setField('bio', e.target.value)}
            />
            <span className="profile-row__counter">{values.bio.length}/200</span>
          </label>

          <label className="profile-row">
            <span className="profile-row__label">个性签名</span>
            <input
              className="profile-row__input"
              type="text"
              maxLength={100}
              placeholder="一句话签名"
              value={values.signature}
              onChange={e => setField('signature', e.target.value)}
            />
          </label>

          <label className="profile-row">
            <span className="profile-row__label">所在地区</span>
            <input
              className="profile-row__input"
              type="text"
              maxLength={20}
              placeholder="如：广东深圳"
              value={values.regionCode}
              onChange={e => setField('regionCode', e.target.value)}
            />
          </label>

          <button
            type="button"
            className="profile-row profile-row--clickable"
            onClick={() => setOptionModal({ key: 'language' })}
          >
            <span className="profile-row__label">语言</span>
            <span className="profile-row__value">
              {findOptionLabel(LANGUAGE_OPTIONS, values.language)}
              <span className="profile-row__arrow">›</span>
            </span>
          </button>

          <button
            type="button"
            className="profile-row profile-row--clickable"
            onClick={() => setOptionModal({ key: 'timezone' })}
          >
            <span className="profile-row__label">时区</span>
            <span className="profile-row__value">
              {findOptionLabel(TIMEZONE_OPTIONS, values.timezone)}
              <span className="profile-row__arrow">›</span>
            </span>
          </button>
        </section>

        {/* 卡片 4：我的会员 */}
        <section
          className="profile-card profile-card--member"
          style={{ background: `linear-gradient(135deg, ${memberColor}, ${memberColor}cc)` }}
          onClick={handleGotoMember}
          role="button"
          tabIndex={0}
        >
          <div className="profile-member__top">
            <span className="profile-member__name">🥇 {memberLabel}</span>
            <span className="profile-member__points">{memberPoints} 积分</span>
          </div>
          {isMaxLevel ? (
            <div className="profile-member__progress-text">已达最高等级 ✨</div>
          ) : memberInfo ? (
            <>
              <div className="profile-member__progress">
                <div
                  className="profile-member__progress-bar"
                  style={{ width: `${Math.min(100, Math.max(0, memberProgress))}%` }}
                />
              </div>
              <div className="profile-member__progress-text">
                距 {nextLevelName} 还差 {memberRemaining} 成长值
              </div>
            </>
          ) : (
            <div className="profile-member__progress-text">点击查看会员等级</div>
          )}
          {isPaid && <div className="profile-member__paid">{paidLabel}</div>}
        </section>

        {/* 卡片 5：邀请码 */}
        <section className="profile-card profile-card--referral">
          <span className="profile-card__title profile-card__title--inline">我的邀请码</span>
          <div className="profile-referral">
            <span className="profile-referral__code">{profileExtra?.referralCode || '加载中...'}</span>
            <button
              type="button"
              className="profile-referral__copy"
              disabled={!profileExtra?.referralCode}
              onClick={handleCopyReferral}
            >
              📋 复制
            </button>
          </div>
        </section>
      </main>

      {/* 离开拦截弹窗 */}
      <AppModal
        visible={!!pendingNav}
        title="资料未保存"
        contentType="text"
        content="你有未保存的改动，确定要离开吗？离开后改动将丢失。"
        confirmText="离开"
        cancelText="留下"
        showClose={false}
        maskClosable={false}
        onConfirm={() => { const n = pendingNav; setPendingNav(null); n?.(); }}
        onCancel={() => setPendingNav(null)}
      />

      {/* 头像 URL 编辑弹窗 */}
      <AppModal
        visible={avatarModalVisible}
        title="设置头像"
        contentType="text"
        content={
          <div style={{ padding: '16px 0' }}>
            <input
              type="url"
              className="profile-row__input"
              placeholder="请输入头像图片 URL"
              value={avatarInput}
              onChange={e => setAvatarInput(e.target.value)}
              style={{ width: '100%', height: 80, padding: '0 24px', fontSize: 28, border: '1px solid #d9d9d9', borderRadius: 8, boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: 16, fontSize: 22, color: '#999' }}>
              提示：V1 仅支持 URL，V2 将支持上传
            </div>
          </div>
        }
        confirmText="确认"
        cancelText="取消"
        onConfirm={confirmAvatar}
        onCancel={() => setAvatarModalVisible(false)}
        onClose={() => setAvatarModalVisible(false)}
      />

      {/* 性别选择弹窗 */}
      <AppModal
        visible={genderModalVisible}
        title="选择性别"
        contentType="text"
        content={
          <div className="profile-options">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`profile-options__item ${values.gender === opt.value ? 'profile-options__item--active' : ''}`}
                onClick={() => { setField('gender', opt.value); setGenderModalVisible(false); }}
              >{opt.label}</button>
            ))}
          </div>
        }
        showClose
        confirmText=""
        cancelText="取消"
        onCancel={() => setGenderModalVisible(false)}
        onClose={() => setGenderModalVisible(false)}
      />

      {/* 语言/时区选择弹窗 */}
      <AppModal
        visible={!!optionModal}
        title={optionModal?.key === 'language' ? '选择语言' : '选择时区'}
        contentType="text"
        content={
          <div className="profile-options">
            {optionsForModal.map(opt => {
              const current = optionModal?.key === 'language' ? values.language : values.timezone;
              const active = current === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`profile-options__item ${active ? 'profile-options__item--active' : ''}`}
                  onClick={() => {
                    if (optionModal?.key === 'language') setField('language', opt.value);
                    else setField('timezone', opt.value);
                    setOptionModal(null);
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
        }
        showClose
        confirmText=""
        cancelText="取消"
        onCancel={() => setOptionModal(null)}
        onClose={() => setOptionModal(null)}
      />
    </div>
  );
};

export default ProfilePage;
