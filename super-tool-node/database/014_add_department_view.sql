-- ============================================================
-- Phase 2: 部门级数据视图 - 角色分类字段
-- ============================================================

-- 为 roles 表新增 role_category 字段，用于区分系统角色和部门角色
ALTER TABLE roles
  ADD COLUMN role_category ENUM('system', 'department', 'custom')
  DEFAULT 'system' AFTER status
  COMMENT '角色分类: system=系统内置/department=部门角色/custom=自定义';

-- 将现有角色标记为 system
UPDATE roles SET role_category = 'system' WHERE role_category IS NULL;
