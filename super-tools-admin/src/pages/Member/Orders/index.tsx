/**
 * 管理端订单列表
 *
 * - 4 张统计卡（总订单 / 已支付 / 付费率 / 总营收）
 * - 4 字段筛选（用户ID / 状态 / 日期范围）
 * - 列表 9 列（订单号/用户/套餐/金额/状态/场景/创建时间/支付时间/操作）
 * - 详情：DetailDrawer（只读）
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Form,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  listOrders,
  getOrderStats,
  AdminOrder,
  OrderListQuery,
  OrderStats,
} from '@/services/order';
import { formatCurrency } from '@/utils/memberFormat';
import { formatDateTime } from '@/utils/format';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SCENE_LABELS,
} from '@/utils/orderFormat';
import DetailDrawer from './DetailDrawer';
import './index.less';

const { RangePicker } = DatePicker;

const OrdersPage: React.FC = () => {
  const [list, setList] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<OrderListQuery>({});
  const [form] = Form.useForm();
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res: any = await listOrders({ page, pageSize, ...filters });
      if (res?.code === 200 && res.data) {
        setList(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res: any = await getOrderStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      if (res?.code === 200) setStats(res.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const columns = useMemo(
    () => [
      {
        title: '订单号',
        dataIndex: 'orderNo',
        width: 200,
        render: (v: string) => <code>{v}</code>,
      },
      {
        title: '用户',
        dataIndex: 'user',
        width: 160,
        render: (u: any, row: AdminOrder) =>
          u
            ? `${u.username || u.nickname || '-'}(#${row.userId})`
            : `#${row.userId}`,
      },
      {
        title: '套餐',
        dataIndex: 'planSnapshot',
        width: 130,
        render: (snap: any, row: AdminOrder) => snap?.name || row.planCode,
      },
      {
        title: '订单金额',
        dataIndex: 'amount',
        width: 100,
        render: (v: any) => formatCurrency(v),
      },
      {
        title: '实际支付',
        dataIndex: 'actualAmount',
        width: 100,
        render: (v: any, row: AdminOrder) => {
          // 已取消(2)、已过期(3)：未实际支付
          // 已退款(4)：实际支付为0（已退款）
          if (row.status === 2 || row.status === 3 || row.status === 4) {
            return <span style={{ color: '#999' }}>-</span>;
          }
          
          // 已支付(1)：显示实际支付金额
          const actual = v !== null && v !== undefined ? Number(v) : null;
          const original = Number(row.amount);
          if (actual !== null && actual !== original) {
            return <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{formatCurrency(actual)}</span>;
          }
          return formatCurrency(actual ?? original);
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (v: number) => (
          <Tag color={ORDER_STATUS_COLORS[v]}>{ORDER_STATUS_LABELS[v] || v}</Tag>
        ),
      },
      {
        title: '场景',
        dataIndex: 'scene',
        width: 70,
        render: (v: number) => SCENE_LABELS[v] || v,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 170,
        render: (v: string) => formatDateTime(v),
      },
      {
        title: '支付时间',
        dataIndex: 'paidAt',
        width: 170,
        render: (v: string) => (v ? formatDateTime(v) : '-'),
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right' as const,
        render: (_: any, row: AdminOrder) => (
          <a
            onClick={() => {
              setDetail(row);
              setDrawerVisible(true);
            }}
          >
            详情
          </a>
        ),
      },
    ],
    [],
  );

  return (
    <Card title="会员订单" className="page-member-orders">
      {/* 4 张统计卡 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总订单" value={stats?.totalOrders ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已支付" value={stats?.paidOrders ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="付费率"
              value={(stats?.payRate ?? 0) * 100}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总营收"
              value={stats?.totalRevenue ?? 0}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选 */}
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            userId: v.userId,
            status: v.status,
            startDate: v.range?.[0]?.toISOString(),
            endDate: v.range?.[1]?.toISOString(),
          });
        }}
        onReset={() => {
          setPage(1);
          setFilters({});
        }}
      >
        <Form.Item name="userId">
          <InputNumber placeholder="用户 ID" min={1} style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="status">
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            options={Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => ({
              value: Number(k),
              label: v,
            }))}
          />
        </Form.Item>
        <Form.Item name="range">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button htmlType="reset">重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchList();
            fetchStats();
          }}
        >
          刷新
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1300 }}
      />

      <DetailDrawer
        visible={drawerVisible}
        target={detail}
        onClose={() => setDrawerVisible(false)}
        onRefunded={() => {
          // 退款成功后刷新列表（订单状态会变为 4 已退款）
          fetchList();
        }}
      />
    </Card>
  );
};

export default OrdersPage;
