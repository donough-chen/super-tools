import React, { useEffect, useState } from 'react';
import { Modal, Checkbox, Spin, message, Tag, Space, Alert, Descriptions } from 'antd';
import type { PermissionTreeNode } from '@/services/permission';
import { getPermissionHolders, batchAssignPermToRoles } from '@/services/permission';
import { listRoles, Role } from '@/services/role';

interface Props {
  visible: boolean;
  permission: PermissionTreeNode | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchAssignRolesModal: React.FC<Props> = ({ visible, permission, onClose, onSuccess }) => {
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [currentHolderIds, setCurrentHolderIds] = useState<number[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && permission) {
      setLoading(true);
      Promise.all([
        listRoles({ pageSize: 100 }),
        getPermissionHolders(permission.id),
      ]).then(([rolesRes, holdersRes]: any[]) => {
        const roles: Role[] = rolesRes?.data?.list || [];
        const filteredRoles = roles.filter((r) => r.code !== 'super_admin');
        setAllRoles(filteredRoles);

        const holderIds: number[] = (holdersRes?.data?.roles || []).map((r: any) => r.id);
        setCurrentHolderIds(holderIds);
        setCheckedIds(holderIds);
      }).catch((e: any) => {
        message.error(e?.message || '加载数据失败');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setAllRoles([]);
      setCurrentHolderIds([]);
      setCheckedIds([]);
    }
  }, [visible, permission]);

  const handleSave = async () => {
    if (!permission) return;
    setSaving(true);
    try {
      const toAdd = checkedIds.filter((id) => !currentHolderIds.includes(id));
      const toRemove = currentHolderIds.filter((id) => !checkedIds.includes(id));

      if (toAdd.length === 0 && toRemove.length === 0) {
        message.info('未做任何变更');
        onClose();
        return;
      }

      const res: any = await batchAssignPermToRoles(permission.id, toAdd, toRemove);
      if (res?.code === 200) {
        message.success(`操作成功（添加 ${toAdd.length} 个, 移除 ${toRemove.length} 个）`);
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={permission ? `批量赋权：${permission.name} (${permission.code})` : '批量赋权'}
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      destroyOnClose
      width={560}
    >
      <Spin spinning={loading}>
        {permission && (
          <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="权限编码"><Tag>{permission.code}</Tag></Descriptions.Item>
            <Descriptions.Item label="权限名称">{permission.name}</Descriptions.Item>
          </Descriptions>
        )}

        <Alert
          type="info"
          showIcon
          message="勾选角色即拥有该权限，取消勾选则移除。super_admin 无需手动赋权（中间件短路）。"
          style={{ marginBottom: 16 }}
        />

        <Checkbox.Group
          value={checkedIds}
          onChange={(vals) => setCheckedIds(vals as number[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {allRoles.map((role) => (
            <Checkbox key={role.id} value={role.id}>
              <Space>
                <Tag color={role.type === 1 ? 'blue' : 'default'}>{role.code}</Tag>
                <span>{role.name}</span>
                {role.status === 0 && <Tag color="red">停用</Tag>}
              </Space>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Spin>
    </Modal>
  );
};

export default BatchAssignRolesModal;
