import React from 'react';
import { Tag, Space } from 'antd';
import type { DataNode } from 'antd/lib/tree';
import type { PermissionTreeNode } from '@/services/permission';

/**
 * PermissionTreeNode → Antd TreeData
 * - title 显示：[code Tag] [name] [类型徽章（按钮/HTTP 方法）]
 * - 用于 Roles 赋权抽屉 / Permissions 浏览页 / PermissionTest role-check 矩阵
 */
export function toAntdTreeData(nodes: PermissionTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: (
      <Space>
        <Tag>{n.code}</Tag>
        <span>{n.name}</span>
        {n.type === 3 && <Tag color="purple">按钮</Tag>}
        {n.type === 4 && <Tag color="cyan">{n.method}</Tag>}
      </Space>
    ),
    children: n.children?.length ? toAntdTreeData(n.children) : undefined,
  }));
}

/**
 * 从 checkedKeys 过滤出叶子 ID（保存赋权时用）
 * - 叶子 = 无 children 的节点（type=3 按钮 / type=4 API）
 * - 父节点（type=1 顶级 / type=2 菜单）即使被勾选也不传给后端
 */
export function filterLeafIds(
  tree: PermissionTreeNode[],
  checked: number[],
): number[] {
  const leafIds = new Set<number>();
  const walk = (nodes: PermissionTreeNode[]) => {
    for (const n of nodes) {
      const isLeaf = !n.children || n.children.length === 0;
      if (isLeaf && checked.includes(n.id)) leafIds.add(n.id);
      if (n.children) walk(n.children);
    }
  };
  walk(tree);
  return Array.from(leafIds);
}

/** 统计已勾选的叶子数（按钮文案显示） */
export function countLeaves(tree: PermissionTreeNode[], checked: number[]): number {
  return filterLeafIds(tree, checked).length;
}
