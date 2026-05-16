import { useCallback, useEffect, useState } from 'react';
import type { NotificationPreferenceItem } from '../types/domain';

/**
 * 用户偏好设置（加载 + 更新）
 */
export function usePreferences(opts: {
  fetchAll: () => Promise<NotificationPreferenceItem[]>;
  saveOne: (input: { typeId: number; channel: string; isSubscribed: boolean }) => Promise<void>;
}) {
  const [list, setList] = useState<NotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await opts.fetchAll());
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);

  const update = useCallback(async (input: { typeId: number; channel: string; isSubscribed: boolean }) => {
    setSaving(true);
    try {
      await opts.saveOne(input);
      // 乐观更新本地状态
      setList((prev) =>
        prev.map((p) =>
          p.typeId === input.typeId && p.channel === input.channel
            ? { ...p, isSubscribed: input.isSubscribed }
            : p,
        ),
      );
    } finally {
      setSaving(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { list, loading, saving, update, reload };
}
