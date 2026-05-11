import React from 'react';
import { Drawer, Descriptions, Tag, Alert } from 'antd';
import type { PermissionTreeNode } from '@/services/permission';

interface Props {
  visible: boolean;
  permission: PermissionTreeNode | null;
  onClose: () => void;
}

const TYPE_LABEL: Record<number, string> = {
  1: '顶级目录',
  2: '菜单',
  3: '按钮',
  4: 'API',
};

const PermissionDetailDrawer: React.FC<Props> = ({ visible, permission, onClose }) => {
  return (
    <Drawer
      title="权限详情（只读）"
      open={visible}
      onClose={onClose}
      width={500}
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
            <Descriptions.Item label="创建时间">{permission.createdAt || '-'}</Descriptions.Item>
          </Descriptions>

          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="只读浏览"
            description="权限码与后端代码强绑定，需要修改请通过数据库迁移脚本完成。"
          />
        </>
      ) : null}
    </Drawer>
  );
};

export default PermissionDetailDrawer;
