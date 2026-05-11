import React from 'react';
import {
  Drawer, Descriptions, Tag, Row, Col, Typography, Divider, Table, Spin, Alert,
} from 'antd';
import type { AuditLogDetail } from '@/services/audit-log';
import { diffFields } from '@/utils/diffFields';

const { Text, Title } = Typography;

interface Props {
  visible: boolean;
  detail: AuditLogDetail | null;
  loading: boolean;
  onClose: () => void;
}

const preStyle: React.CSSProperties = {
  background: '#f5f5f5',
  padding: 12,
  borderRadius: 4,
  maxHeight: 400,
  overflow: 'auto',
  fontSize: 12,
  margin: 0,
};

const AuditDetailDrawer: React.FC<Props> = ({ visible, detail, loading, onClose }) => {
  const diffData = detail
    ? diffFields(detail.beforeData, detail.afterData).map((e, i) => ({ ...e, _key: i }))
    : [];

  return (
    <Drawer title="审计详情" open={visible} onClose={onClose} width={1100} destroyOnClose>
      <Spin spinning={loading}>
        {detail ? (
          <>
            {/* 元信息 */}
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="时间">{detail.createdAt}</Descriptions.Item>
              <Descriptions.Item label="用户">
                {detail.username} ({detail.userId})
              </Descriptions.Item>
              <Descriptions.Item label="模块">
                <Tag>{detail.module}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="动作">
                <Tag>{detail.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="业务">
                {detail.bizType} #{detail.bizId}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 1
                  ? <Tag color="green">成功</Tag>
                  : <Tag color="red">失败</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">{detail.costTime} ms</Descriptions.Item>
              <Descriptions.Item label="IP">{detail.ip}</Descriptions.Item>
              <Descriptions.Item label="描述" span={3}>
                {detail.description}
              </Descriptions.Item>
              <Descriptions.Item label="URL" span={3}>
                <Tag>{detail.requestMethod}</Tag> {detail.requestUrl}
              </Descriptions.Item>
              {detail.failReason && (
                <Descriptions.Item label="失败原因" span={3}>
                  <Alert type="error" message={detail.failReason} showIcon />
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 双列 JSON 原文 */}
            <Divider>变更对比（JSON 原文）</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Title level={5}>变更前</Title>
                <pre style={preStyle}>
                  {detail.beforeData
                    ? JSON.stringify(detail.beforeData, null, 2)
                    : '(无)'}
                </pre>
              </Col>
              <Col span={12}>
                <Title level={5}>变更后</Title>
                <pre style={preStyle}>
                  {detail.afterData
                    ? JSON.stringify(detail.afterData, null, 2)
                    : '(无)'}
                </pre>
              </Col>
            </Row>

            {/* 字段对比表 */}
            <Divider>变化字段对比</Divider>
            <Table
              size="small"
              pagination={false}
              dataSource={diffData}
              rowKey="_key"
              columns={[
                { title: '字段', dataIndex: 'key', width: 200 },
                {
                  title: '变更前', dataIndex: 'before',
                  render: (v) => <Text code>{JSON.stringify(v)}</Text>,
                },
                {
                  title: '变更后', dataIndex: 'after',
                  render: (v) => <Text code>{JSON.stringify(v)}</Text>,
                },
              ]}
              locale={{ emptyText: '无字段变化' }}
            />

            {/* 请求参数 */}
            {detail.requestParams && (
              <>
                <Divider>请求参数</Divider>
                <pre style={preStyle}>{JSON.stringify(detail.requestParams, null, 2)}</pre>
              </>
            )}
          </>
        ) : null}
      </Spin>
    </Drawer>
  );
};

export default AuditDetailDrawer;
