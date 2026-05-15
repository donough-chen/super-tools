import React, { useEffect, useState } from 'react';
import {
  Drawer, Collapse, Descriptions, Tag, Spin, Space, Button, Empty, Progress,
} from 'antd';
import {
  getMemberUser,
  MemberUser, MemberInfoExtra,
} from '@/services/member';
import { formatCurrency } from '@/utils/memberFormat';
import { formatDateTime } from '@/utils/format';
import AdjustPointsForm from './AdjustPointsForm';
import AdjustLevelForm from './AdjustLevelForm';
import ActivatePlanForm from './ActivatePlanForm';

interface Props {
  visible: boolean;
  target: MemberUser | null;
  onClose: () => void;
  onSuccess: () => void;
  onJumpToLogs?: (userId: number) => void;
}

const DetailDrawer: React.FC<Props> = ({
  visible, target, onClose, onSuccess, onJumpToLogs,
}) => {
  const [extra, setExtra] = useState<MemberInfoExtra | null>(null);
  const [loading, setLoading] = useState(false);

  // 拉详情接口（增量信息：nextLevel / paid 详情）
  const refetchExtra = async () => {
    if (!target) return;
    setLoading(true);
    try {
      const r: any = await getMemberUser(target.userId);
      if (r?.code === 200) setExtra(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && target) {
      refetchExtra();
    } else if (!visible) {
      setExtra(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, target]);

  const handleSuccess = async () => {
    // 写操作成功后：刷新增量信息 + 通知列表刷新
    await refetchExtra();
    onSuccess();
  };

  const handleJumpToLogs = () => {
    if (target && onJumpToLogs) {
      onJumpToLogs(target.userId);
      onClose();
    }
  };

  return (
    <Drawer
      title={`会员详情 #${target?.userId ?? ''}`}
      width={720}
      open={visible}
      onClose={onClose}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {!target ? <Empty /> : (
          <Collapse
            defaultActiveKey={['basic', 'points', 'level', 'plan']}
            items={[
              {
                key: 'basic', label: '基础信息',
                children: (
                  <>
                    <Descriptions column={2} bordered size="small">
                      <Descriptions.Item label="用户">
                        {target.user?.nickname
                          ? `${target.user.nickname} (#${target.userId})`
                          : `#${target.userId}`}
                      </Descriptions.Item>
                      <Descriptions.Item label="手机/邮箱">
                        {target.user?.phone || target.user?.email || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="当前等级">
                        {target.level ? (
                          <Tag color={target.level.color || 'default'}>
                            {target.level.name}（level={target.level.level}）
                          </Tag>
                        ) : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="付费状态">
                        {target.isPaid === 1
                          ? <Tag color="gold">已付费</Tag>
                          : <Tag>未付费</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="当前积分">{target.points}</Descriptions.Item>
                      <Descriptions.Item label="累计积分">{target.totalPoints}</Descriptions.Item>
                      <Descriptions.Item label="成长值">{target.growthValue}</Descriptions.Item>
                      <Descriptions.Item label="累计消费">{formatCurrency(target.totalConsume)}</Descriptions.Item>
                      <Descriptions.Item label="套餐编码">
                        {target.paidPlanCode ? <Tag>{target.paidPlanCode}</Tag> : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="套餐到期">
                        {formatDateTime(target.paidExpireAt)}
                      </Descriptions.Item>
                      {extra?.nextLevel && (
                        <Descriptions.Item label="升级进度" span={2}>
                          <div>
                            距离 <strong>{extra.nextLevel.name}</strong> 还差 {extra.nextLevel.remaining} 成长值
                          </div>
                          <Progress
                            percent={Math.round((extra.nextLevel.progress || 0) * 100)}
                            size="small"
                          />
                        </Descriptions.Item>
                      )}
                      {extra?.paid?.daysRemaining != null && (
                        <Descriptions.Item label="付费剩余" span={2}>
                          <Tag color={extra.paid.daysRemaining > 7 ? 'green' : 'orange'}>
                            {extra.paid.daysRemaining} 天
                          </Tag>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                    <Space style={{ marginTop: 12 }}>
                      <Button onClick={handleJumpToLogs} disabled={!onJumpToLogs}>
                        查积分流水
                      </Button>
                    </Space>
                  </>
                ),
              },
              {
                key: 'points', label: '调整积分',
                children: (
                  <AdjustPointsForm
                    userId={target.userId}
                    onSuccess={handleSuccess}
                  />
                ),
              },
              {
                key: 'level', label: '调整等级',
                children: (
                  <AdjustLevelForm
                    userId={target.userId}
                    currentLevelId={target.levelId}
                    onSuccess={handleSuccess}
                  />
                ),
              },
              {
                key: 'plan', label: '开通套餐',
                children: (
                  <ActivatePlanForm
                    userId={target.userId}
                    currentPlanCode={target.paidPlanCode}
                    onSuccess={handleSuccess}
                  />
                ),
              },
            ]}
          />
        )}
      </Spin>
    </Drawer>
  );
};

export default DetailDrawer;
