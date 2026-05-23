/**
 * 订单详情抽屉（Phase 2 — 含退款功能）
 *
 * - 数据源：getOrder(id) 含 user / payments / refunds / planSnapshot / source*
 * - 退款按钮：仅 status=1 + 无成功退款时显示，需 perm: member:refund:create
 * - 退款流程：弹 Modal 输入原因 → 调 createRefund → 成功后刷新详情
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer, Descriptions, Spin, Tag, Table, Empty, Card,
  Button, Modal, Input, message, Popconfirm,
} from 'antd';
import { getOrder, AdminOrder } from '@/services/order';
import { createRefund } from '@/services/refund';
import { formatCurrency } from '@/utils/memberFormat';
import { formatDateTime } from '@/utils/format';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_COLORS,
  SCENE_LABELS,
  SCENE_COLORS,
} from '@/utils/orderFormat';

interface Props {
  visible: boolean;
  target: AdminOrder | null;
  onClose: () => void;
  /** 退款成功后回调（让外层列表刷新） */
  onRefunded?: () => void;
}

const DetailDrawer: React.FC<Props> = ({ visible, target, onClose, onRefunded }) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 退款 Modal
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const fetchDetail = useCallback(() => {
    if (!target) return;
    setLoading(true);
    getOrder(target.id)
      .then((res: any) => {
        if (res?.code === 200) setDetail(res.data);
      })
      .finally(() => setLoading(false));
  }, [target]);

  useEffect(() => {
    if (!visible || !target) {
      setDetail(null);
      return;
    }
    fetchDetail();
  }, [visible, target, fetchDetail]);

  /** 是否可退款：status=1 + 无 status∈{0,1} 的现存 refund */
  const canRefund = (() => {
    if (!detail) return false;
    if (detail.status !== 1) return false;
    const refunds = detail.refunds || [];
    return !refunds.some((r: any) => r.status === 0 || r.status === 1);
  })();

  const handleRefund = useCallback(async () => {
    if (!detail) return;
    if (!refundReason.trim()) {
      message.warning('请输入退款原因');
      return;
    }
    setRefunding(true);
    try {
      const res: any = await createRefund(detail.id, refundReason.trim());
      if (res?.code !== 200) {
        throw new Error(res?.message || '退款失败');
      }
      message.success('退款成功');
      setRefundModalVisible(false);
      setRefundReason('');
      fetchDetail(); // 刷新当前 drawer
      onRefunded?.(); // 通知外层
    } catch (e: any) {
      message.error(e?.message || '退款失败');
    } finally {
      setRefunding(false);
    }
  }, [detail, refundReason, fetchDetail, onRefunded]);

  return (
    <Drawer
      title={`订单详情 #${target?.orderNo || ''}`}
      width={760}
      open={visible}
      onClose={onClose}
      destroyOnClose
      extra={
        canRefund && (
          <Button
            danger
            type="primary"
            onClick={() => setRefundModalVisible(true)}
          >
            发起退款
          </Button>
        )
      }
    >
      <Spin spinning={loading}>
        {!detail ? (
          <Empty />
        ) : (
          <>
            <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="订单号">{detail.orderNo}</Descriptions.Item>
                <Descriptions.Item label="用户">
                  {detail.user
                    ? `${detail.user.username || detail.user.nickname || '-'}(#${detail.userId})`
                    : `#${detail.userId}`}
                </Descriptions.Item>
                <Descriptions.Item label="套餐">
                  {detail.planSnapshot?.name || detail.planCode}
                </Descriptions.Item>
                <Descriptions.Item label="金额">
                  {formatCurrency(detail.amount)}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={ORDER_STATUS_COLORS[detail.status]}>
                    {ORDER_STATUS_LABELS[detail.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="场景">
                  <Tag color={SCENE_COLORS[detail.scene] || 'default'}>
                    {SCENE_LABELS[detail.scene] || detail.scene}
                  </Tag>
                </Descriptions.Item>

                {/* Phase 2：升降级订单展示原套餐 + 剩余价值 */}
                {(detail.scene === 3 || detail.scene === 4) && detail.sourcePlanCode && (
                  <>
                    <Descriptions.Item label="原套餐">{detail.sourcePlanCode}</Descriptions.Item>
                    <Descriptions.Item label="剩余价值">
                      {detail.sourceRemainingValue
                        ? formatCurrency(detail.sourceRemainingValue)
                        : '-'}
                    </Descriptions.Item>
                  </>
                )}

                <Descriptions.Item label="创建时间">
                  {formatDateTime(detail.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="支付时间">
                  {detail.paidAt ? formatDateTime(detail.paidAt) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="过期时间" span={2}>
                  {detail.expireAt ? formatDateTime(detail.expireAt) : '-'}
                </Descriptions.Item>
                {detail.cancelledAt && (
                  <Descriptions.Item label="取消时间" span={2}>
                    {formatDateTime(detail.cancelledAt)}
                  </Descriptions.Item>
                )}
                {detail.remark && (
                  <Descriptions.Item label="备注" span={2}>
                    {detail.remark}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card size="small" title="套餐快照（下单时）" style={{ marginBottom: 16 }}>
              <pre
                style={{
                  fontSize: 12,
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  margin: 0,
                }}
              >
                {JSON.stringify(detail.planSnapshot, null, 2)}
              </pre>
            </Card>

            <Card
              size="small"
              title={`支付流水（共 ${detail.payments?.length || 0} 笔）`}
              style={{ marginBottom: 16 }}
            >
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.payments || []}
                columns={[
                  {
                    title: '#',
                    width: 40,
                    render: (_: any, __: any, i: number) => i + 1,
                  },
                  {
                    title: '流水号',
                    dataIndex: 'paymentNo',
                    render: (v: string) => <code>{v}</code>,
                  },
                  { title: '渠道', dataIndex: 'provider', width: 110 },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    width: 90,
                    render: (v: any) => formatCurrency(v),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (v: number) => (
                      <Tag color={PAYMENT_STATUS_COLORS[v]}>
                        {PAYMENT_STATUS_LABELS[v] || v}
                      </Tag>
                    ),
                  },
                  {
                    title: '时间',
                    dataIndex: 'createdAt',
                    width: 170,
                    render: (v: string) => formatDateTime(v),
                  },
                ]}
              />
            </Card>

            {/* Phase 2：退款记录卡片（仅当有退款时显示） */}
            {detail.refunds && detail.refunds.length > 0 && (
              <Card size="small" title={`退款记录（共 ${detail.refunds.length} 笔）`}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={detail.refunds}
                  columns={[
                    {
                      title: '#',
                      width: 40,
                      render: (_: any, __: any, i: number) => i + 1,
                    },
                    {
                      title: '退款单号',
                      dataIndex: 'refundNo',
                      render: (v: string) => <code>{v}</code>,
                    },
                    { title: '渠道', dataIndex: 'provider', width: 90 },
                    {
                      title: '金额',
                      dataIndex: 'amount',
                      width: 90,
                      render: (v: any) => formatCurrency(v),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 90,
                      render: (v: number) => (
                        <Tag color={REFUND_STATUS_COLORS[v]}>
                          {REFUND_STATUS_LABELS[v] || v}
                        </Tag>
                      ),
                    },
                    {
                      title: '退款原因',
                      dataIndex: 'reason',
                      ellipsis: true,
                    },
                    {
                      title: '退款时间',
                      dataIndex: 'refundedAt',
                      width: 170,
                      render: (v: string, row: any) =>
                        formatDateTime(v || row.createdAt),
                    },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </Spin>

      {/* 退款 Modal */}
      <Modal
        title="发起退款"
        open={refundModalVisible}
        onCancel={() => {
          setRefundModalVisible(false);
          setRefundReason('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setRefundModalVisible(false)}>
            取消
          </Button>,
          <Popconfirm
            key="confirm"
            title="确认退款？"
            description={`将退还订单 ${detail?.orderNo} 共 ${formatCurrency(detail?.amount || '0')}，且会员立即失效`}
            onConfirm={handleRefund}
            okText="确认退款"
            cancelText="再想想"
          >
            <Button type="primary" danger loading={refunding}>
              确认退款
            </Button>
          </Popconfirm>,
        ]}
      >
        <p>
          订单号：<code>{detail?.orderNo}</code>
        </p>
        <p>
          退款金额：<strong>{formatCurrency(detail?.amount || '0')}</strong>
        </p>
        <p style={{ color: '#fa8c16' }}>
          ⚠️ 退款成功后：会员立即失效（is_paid=0）+ 订单状态置为已退款 + 用户收到站内信通知。
          <br />
          本操作会调用通道退款（mock=立即成功 / alipay=同步等结果），失败会自动回滚。
        </p>
        <Input.TextArea
          rows={3}
          maxLength={200}
          showCount
          placeholder="请输入退款原因（必填，最多 200 字）"
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
        />
      </Modal>
    </Drawer>
  );
};

export default DetailDrawer;
