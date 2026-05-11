import React, { useEffect, useState } from 'react';
import { Drawer, Tree, Spin, Button, Space, Popconfirm, message, Empty } from 'antd';
import type { Role } from '@/services/role';
import { assignRolePermissions, getRole } from '@/services/role';
import { getPermissionTree, PermissionTreeNode } from '@/services/permission';
import { toAntdTreeData, filterLeafIds, countLeaves } from '@/pages/System/_shared/treeUtils';

interface Props {
  visible: boolean;
  role: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AssignPermDrawer: React.FC<Props> = ({ visible, role, onClose, onSuccess }) => {
  const [permTree, setPermTree] = useState<PermissionTreeNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && role) {
      setLoading(true);
      Promise.all([
        getPermissionTree(),
        getRole(role.id),
      ]).then(([treeRes, roleRes]: any[]) => {
        const tree: PermissionTreeNode[] = treeRes?.data || [];
        // 后端 role detail 返回的 permissions 是对象数组 [{id, code, name, type}]
        // （Sequelize include as:'permissions'）
        const granted: number[] = (roleRes?.data?.permissions || [])
          .map((p: any) => Number(p.id))
          .filter((n: number) => !Number.isNaN(n));
        setPermTree(tree);
        setCheckedKeys(granted);
        setExpandedKeys(tree.map((n) => n.id));
      }).catch((e: any) => {
        message.error(e?.message || '加载权限数据失败');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      // 关闭时清理
      setPermTree([]);
      setCheckedKeys([]);
      setExpandedKeys([]);
    }
  }, [visible, role]);

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const leafIds = filterLeafIds(permTree, checkedKeys);
      const res: any = await assignRolePermissions(role.id, leafIds);
      if (res?.code === 200) {
        message.success(`赋权成功（已授予 ${leafIds.length} 项）`);
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '赋权失败');
      }
    } catch (e: any) {
      message.error(e?.message || '赋权失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={role ? `赋权：${role.name} (${role.code})` : '赋权'}
      open={visible}
      onClose={onClose}
      width={600}
      destroyOnClose
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Popconfirm
            title="确认保存当前权限配置？"
            onConfirm={handleSave}
            disabled={saving}
          >
            <Button type="primary" loading={saving}>
              保存（已选 {countLeaves(permTree, checkedKeys)} 项）
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {permTree.length === 0 && !loading ? (
          <Empty description="暂无权限数据" />
        ) : (
          <Tree
            checkable
            showLine
            treeData={toAntdTreeData(permTree)}
            checkedKeys={checkedKeys}
            expandedKeys={expandedKeys}
            onCheck={(keys) => setCheckedKeys(keys as number[])}
            onExpand={(keys) => setExpandedKeys(keys as number[])}
          />
        )}
      </Spin>
    </Drawer>
  );
};

export default AssignPermDrawer;
