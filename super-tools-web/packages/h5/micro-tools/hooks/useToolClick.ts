/**
 * 工具点击统一处理 hook
 *
 * 策略：
 *   - 工具下架（status=0）→ 弹"已下架"
 *   - 纯免费工具（requiredLevelCode='free' && requirePaid=0）→ 直接跳转
 *   - 需校验工具：
 *     - 未登录 → 弹"去登录"
 *     - 已登录 → GET /api/tools/:code/access
 *       - allowed=true  → 跳转
 *       - allowed=false → 弹"去开通"，按 reason 提示
 *
 * 用法：
 *   const { onClick, dialog, closeDialog } = useToolClick();
 *   <div onClick={() => onClick(tool)} />
 *   <AppModal visible={dialog.visible} title={dialog.title} content={dialog.message}
 *     confirmText={dialog.confirmText} onConfirm={dialog.onConfirm || closeDialog}
 *     onCancel={closeDialog} onClose={closeDialog} />
 */
import { useCallback, useState } from 'react';
import { useHistory } from 'umi';
import { useUserStore } from '../store/user';
import { checkToolAccess } from '../service/tool';
import type { Tool, AccessResult } from '../types/tool';

interface DialogState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm?: () => void;
}

const initialDialog: DialogState = {
  visible: false,
  title: '',
  message: '',
  confirmText: '确定',
};

function reasonToText(r: AccessResult): string {
  if (r.reason === 'need_level') return `该功能需要「${r.required?.levelName || '更高等级'}」及以上等级`;
  if (r.reason === 'need_paid') return '该功能需要付费会员';
  if (r.reason === 'paid_expired') return '您的付费会员已过期，请续费';
  return '您暂无权限使用该功能';
}

export function useToolClick() {
  const history = useHistory();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const [dialog, setDialog] = useState<DialogState>(initialDialog);

  const closeDialog = useCallback(() => setDialog(initialDialog), []);

  const onClick = useCallback(
    async (tool: Tool) => {
      // 1. 工具下架
      if (tool.status === 0) {
        setDialog({
          visible: true,
          title: '提示',
          message: '该工具已下架',
          confirmText: '我知道了',
          onConfirm: () => setDialog(initialDialog),
        });
        return;
      }

      const needAuth = tool.requiredLevelCode !== 'free' || tool.requirePaid === 1;

      // 2. 纯免费工具直接跳转
      if (!needAuth) {
        history.push(tool.path);
        return;
      }

      // 3. 需校验 & 未登录 → 引导登录
      if (!isLoggedIn) {
        setDialog({
          visible: true,
          title: '需要登录',
          message: '使用该工具需要先登录账号',
          confirmText: '去登录',
          onConfirm: () => {
            setDialog(initialDialog);
            history.push('/login?redirect=' + encodeURIComponent(tool.path));
          },
        });
        return;
      }

      // 4. 需校验 & 已登录 → 调后端
      try {
        const res: any = await checkToolAccess(tool.code);
        if (res?.code === 200 && res.data?.allowed) {
          history.push(tool.path);
          return;
        }
        const r = (res?.data || {}) as AccessResult;
        setDialog({
          visible: true,
          title: '升级会员',
          message: reasonToText(r),
          confirmText: '去开通',
          onConfirm: () => {
            setDialog(initialDialog);
            history.push('/member');
          },
        });
      } catch {
        setDialog({
          visible: true,
          title: '提示',
          message: '校验失败，请稍后重试',
          confirmText: '我知道了',
          onConfirm: () => setDialog(initialDialog),
        });
      }
    },
    [history, isLoggedIn],
  );

  return { onClick, dialog, closeDialog };
}
