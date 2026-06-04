/**
 * 工具详情页
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'umi';
import { navigateTo, navigateBack } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import { showToast } from '../../utils/toast';
import { useHomeStore, usePointsMallStore, useUserStore } from '../../store';
import { checkToolAccess } from '../../service/tool';
import { getMallItems } from '../../service/pointsMall';
import type { Tool, AccessResult } from '../../types/tool';
import './[code].less';

const ToolDetailPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [unlockProduct, setUnlockProduct] = useState<any>(null);

  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const unlockedTools = usePointsMallStore((s) => s.unlockedTools);
  const fetchUnlockedTools = usePointsMallStore((s) => s.fetchUnlockedTools);
  const fetchHomeData = useHomeStore((s) => s.fetchHomeData);

  useEffect(() => {
    const loadTool = async () => {
      const homeStore = useHomeStore.getState();
      if (homeStore.categories.length === 0) {
        await fetchHomeData();
      }

      const allTools = Object.values(homeStore.toolsByCategory).flat();
      const found = allTools.find((t: any) => t.code === code);
      
      if (found) {
        setTool(found as Tool);
      }
      setLoading(false);
    };

    loadTool();
  }, [code, fetchHomeData]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUnlockedTools();
    }
  }, [isLoggedIn, fetchUnlockedTools]);

  useEffect(() => {
    if (!tool) return;

    const checkAccess = async () => {
      if (!isLoggedIn) {
        setAccessResult(null);
        return;
      }

      try {
        const res: any = await checkToolAccess(tool.code);
        if (res?.code === 200 && res.data) {
          setAccessResult(res.data as AccessResult);
        }
      } catch (e) {
        console.warn('[ToolDetail] checkAccess failed:', e);
      }
    };

    const findUnlockProduct = async () => {
      if (tool.requiredLevelCode === 'free' && tool.requirePaid !== 1) {
        return;
      }

      try {
        const res: any = await getMallItems({ category: 'tool_unlock', pageSize: 50 });
        if (res?.code === 200 && res.data?.list) {
          const product = res.data.list.find((item: any) => {
            const config = item.fulfillConfig || {};
            return config.tool_code === tool.code;
          });
          setUnlockProduct(product || null);
        }
      } catch (e) {
        console.warn('[ToolDetail] findUnlockProduct failed:', e);
      }
    };

    checkAccess();
    findUnlockProduct();
  }, [tool, isLoggedIn]);

  const isUnlocked = unlockedTools.includes(code || '');
  const canAccess = accessResult?.allowed || isUnlocked;

  const handleUseTool = async () => {
    if (!tool) return;

    if (!isLoggedIn) {
      navigateTo(`/login?redirect=${encodeURIComponent(`/tools/${code}`)}`);
      return;
    }

    if (canAccess) {
      window.location.href = tool.path;
      return;
    }

    if (accessResult && !accessResult.allowed) {
      const reason = accessResult.reason;
      let message = '您暂无权限使用该功能';
      if (reason === 'need_level') {
        message = `该功能需要「${accessResult.required?.levelName || '更高等级'}」及以上等级`;
      } else if (reason === 'need_paid') {
        message = '该功能需要付费会员';
      } else if (reason === 'paid_expired') {
        message = '您的付费会员已过期，请续费';
      }

      showToast(message, 'error');
    }
  };

  const handleUnlock = () => {
    if (!unlockProduct) {
      showToast('未找到对应的解锁商品', 'error');
      return;
    }
    navigateTo(`/points-mall/items/${unlockProduct.id}`);
  };

  const handleUpgrade = () => {
    navigateTo('/member');
  };

  if (loading) {
    return (
      <div className="page-tool-detail">
        <AppHeader title="工具详情" showBack onBack={() => navigateBack()} />
        <div className="page-tool-detail__loading">加载中...</div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="page-tool-detail">
        <AppHeader title="工具详情" showBack onBack={() => navigateBack()} />
        <div className="page-tool-detail__empty">工具不存在或已下架</div>
      </div>
    );
  }

  const firstChar = tool.name ? tool.name[0] : 'T';

  return (
    <div className="page-tool-detail">
      <AppHeader title="工具详情" showBack onBack={() => navigateBack()} />
      <main className="page-tool-detail__content">
        <div className="page-tool-detail__header">
          <div className="page-tool-detail__icon">
            <span className="page-tool-detail__icon-placeholder">{firstChar}</span>
          </div>
          <h1 className="page-tool-detail__name">{tool.name}</h1>
          <p className="page-tool-detail__description">{tool.description || '暂无描述'}</p>
        </div>

        <div className="page-tool-detail__status">
          {isUnlocked ? (
            <div className="page-tool-detail__status-badge page-tool-detail__status-badge--unlocked">
              ✅ 已解锁
            </div>
          ) : canAccess ? (
            <div className="page-tool-detail__status-badge page-tool-detail__status-badge--accessible">
              ✅ 可访问
            </div>
          ) : (
            <div className="page-tool-detail__status-badge page-tool-detail__status-badge--locked">
              🔒 未解锁
            </div>
          )}
        </div>

        <div className="page-tool-detail__info">
          <div className="page-tool-detail__info-item">
            <span className="page-tool-detail__info-label">所需等级</span>
            <span className="page-tool-detail__info-value">{tool.requiredLevelCode || 'free'}</span>
          </div>
          {tool.requirePaid === 1 && (
            <div className="page-tool-detail__info-item">
              <span className="page-tool-detail__info-label">付费要求</span>
              <span className="page-tool-detail__info-value">需要付费会员</span>
            </div>
          )}
        </div>

        <div className="page-tool-detail__actions">
          {canAccess ? (
            <button className="page-tool-detail__btn page-tool-detail__btn--primary" onClick={handleUseTool}>
              立即使用
            </button>
          ) : (
            <>
              {unlockProduct && (
                <button className="page-tool-detail__btn page-tool-detail__btn--unlock" onClick={handleUnlock}>
                  积分解锁 ({unlockProduct.pointsRequired} 积分)
                </button>
              )}
              <button className="page-tool-detail__btn page-tool-detail__btn--upgrade" onClick={handleUpgrade}>
                升级会员
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ToolDetailPage;
