import React, { useEffect, useState } from 'react';
import { Drawer, Descriptions, Tag, Space, Table, Spin, Button, Empty, Divider } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import type { PermissionTreeNode } from '@/services/permission';
import { getPermissionHolders } from '@/services/permission';

interface Props {
  visible: boolean;
  permission: PermissionTreeNode | null;
  onClose: () => void;
  onBatchAssign?: (perm: PermissionTreeNode) => void;
}

const TYPE_LABEL: Record<number, string> = {
  1: '顶级目录',
  2: '菜单',
  3: '按钮',
  4: 'API',
};

const PermissionDetailDrawer: React.FC<Props> = ({ visible, permission, onClose, onBatchAssign }) => {
  const [holders, setHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && permission) {
      setLoading(true);
      getPermissionHolders(permission.id)
        .then((res: any) => {
          setHolders(res?.data?.roles || []);
        })
        .catch(() => setHolders([]))
        .finally(() => setLoading(false));
    } else {
      setHolders([]);
    }
  }, [visible, permission]);

  const holderColumns = [
    {
      title: '角色编码', dataIndex: 'code', width: 140,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: '角色名称', dataIndex: 'name', width: 120 },
    {
      title: '类型', dataIndex: 'type', width: 80,
      render: (v: number) => v === 1 ? '系统' : '自定义',
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number) => (
        <Tag color={v === 1 ? 'green' : 'red'}>{v === 1 ? '启用' : '停用'}</Tag>
      ),
    },
  ];

  return (
    <Drawer
      title="权限详情"
      open={visible}
      onClose={onClose}
      width={600}
      destroyOnClose
    >
      {permission ? (
        <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{permission.id}</Descriptions.Item>
            <Descriptions.Item label="编码">
              <Tag>{permission.code}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="名称">{permission.name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              {TYPE_LABEL[permission.type] || permission.type}
            </Descriptions.Item>
            <Descriptions.Item label="模块">{permission.module || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台">{permission.platform || '-'}</Descriptions.Item>
            <Descriptions.Item label="路径">{permission.path || '-'}</Descriptions.Item>
            <Descriptions.Item label="HTTP 方法">{permission.method || '-'}</Descriptions.Item>
            <Descriptions.Item label="父节点">{permission.parentId ?? '(顶级)'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={permission.status === 1 ? 'green' : 'red'}>
                {permission.status === 1 ? '启用' : '停用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="排序">{permission.sort}</Descriptions.Item>
          </Descriptions>

          <Divider />

          <Space style={{ marginBottom: 12 }}>
            <TeamOutlined />
            <strong>持有该权限的角色（{holders.length}）</strong>
            {onBatchAssign && (
              <AuthButton permCode="system:permission:batch-assign">
                <Button type="link" size="small" onClick={() => onBatchAssign(permission)}>
                  批量赋权
                </Button>
              </AuthButton>
            )}
          </Space>

          <Spin spinning={loading}>
            {holders.length === 0 && !loading ? (
              <Empty description="暂无角色持有该权限" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                rowKey="id"
                columns={holderColumns}
                dataSource={holders}
                pagination={false}
                size="small"
              />
            )}
          </Spin>
        </>
      ) : null}
    </Drawer>
  );
};

export default PermissionDetailDrawer;
