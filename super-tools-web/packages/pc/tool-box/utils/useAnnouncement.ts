import { useCallback } from 'react';
import { useUserStore } from '@/store/user';
import { useGlobalModal } from '@/utils/useGlobalModal';
import { getUnreadAnnouncements, markAnnouncementRead, type Announcement } from '@/services/api';
import AnnouncementContent from '@/components/AnnouncementContent';
import React from 'react';

/** 游客已读公告本地缓存 key */
const GUEST_READ_KEY = 'super_tools_guest_read_announcements';
const GUEST_READ_TTL = 7 * 24 * 60 * 60 * 1000; // 7天

/** 登录用户已读公告本地缓存 key（兜底，防止 session 重置后重复弹出） */
const USER_READ_KEY_PREFIX = 'super_tools_user_read_announcements_';

/** 读取游客已读公告 ID 列表 */
const getGuestReadIds = (): string[] => {
  try {
    const raw = localStorage.getItem(GUEST_READ_KEY);
    if (!raw) return [];
    const { data, expireAt } = JSON.parse(raw);
    if (Date.now() > expireAt) {
      localStorage.removeItem(GUEST_READ_KEY);
      return [];
    }
    return data as string[];
  } catch {
    return [];
  }
};

/** 保存游客已读公告 ID */
const addGuestReadId = (id: string) => {
  try {
    const current = getGuestReadIds();
    if (!current.includes(id)) {
      localStorage.setItem(
        GUEST_READ_KEY,
        JSON.stringify({
          data: [...current, id],
          expireAt: Date.now() + GUEST_READ_TTL,
        }),
      );
    }
  } catch {
    // ignore
  }
};

/** 读取登录用户本地已读公告 ID 列表（兜底缓存，永久有效） */
const getUserReadIds = (userId: string): string[] => {
  try {
    const raw = localStorage.getItem(USER_READ_KEY_PREFIX + userId);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

/** 保存登录用户本地已读公告 ID（兜底缓存） */
const addUserReadId = (userId: string, announcementId: string) => {
  try {
    const current = getUserReadIds(userId);
    if (!current.includes(announcementId)) {
      localStorage.setItem(
        USER_READ_KEY_PREFIX + userId,
        JSON.stringify([...current, announcementId]),
      );
    }
  } catch {
    // ignore
  }
};

/**
 * 公告检查与展示 Hook
 *
 * @example
 * ```tsx
 * const { checkAnnouncements } = useAnnouncement();
 * useEffect(() => { checkAnnouncements(); }, []);
 * ```
 */
export const useAnnouncement = () => {
  const { userInfo, settings } = useUserStore();
  const { showModal } = useGlobalModal();

  /**
   * 展示单条公告弹窗
   */
  const showAnnouncementModal = useCallback(
    (announcement: Announcement, onRead: () => void) => {
      showModal({
        title: announcement.title,
        content: React.createElement(AnnouncementContent, { content: announcement.content }),
        position: 'center',
        width: 560,
        closable: true,
        maskClosable: false,
        showMask: true,
        buttons: [
          {
            text: '我知道了',
            type: 'primary',
            onClick: () => {
              onRead();
            },
          },
        ],
      });
    },
    [showModal],
  );

  /**
   * 检查并展示未读公告
   * - 仅在 notificationEnabled 开启时执行
   * - 登录用户：服务端判断已读状态
   * - 游客：本地 localStorage 判断已读状态
   */
  const checkAnnouncements = useCallback(async () => {
    if (!settings.notificationEnabled) return;

    try {
      const res = await getUnreadAnnouncements();
      if (!res.data || res.data.length === 0) return;

      let unread: Announcement[];

      if (userInfo) {
        // 登录用户：服务端 isRead + 本地缓存双重过滤（防止 session 重置后重复弹出）
        const userReadIds = getUserReadIds(userInfo.id);
        unread = res.data.filter((a) => !a.isRead && !userReadIds.includes(a.id));
      } else {
        // 游客：用本地缓存过滤
        const guestReadIds = getGuestReadIds();
        unread = res.data.filter((a) => !guestReadIds.includes(a.id));
      }

      if (unread.length === 0) return;

      // 展示第一条未读公告
      const first = unread[0];
      showAnnouncementModal(first, async () => {
        // 标记已读
        if (userInfo) {
          // 同时写入本地缓存（兜底，防止 session 重置后重复弹出）
          addUserReadId(userInfo.id, first.id);
          await markAnnouncementRead(first.id).catch(() => {});
        } else {
          addGuestReadId(first.id);
        }
      });
    } catch {
      // 公告接口失败不影响主流程，静默处理
    }
  }, [userInfo, settings.notificationEnabled, showAnnouncementModal]);

  return { checkAnnouncements };
};
