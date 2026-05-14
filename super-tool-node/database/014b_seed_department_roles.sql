-- ============================================================
-- 014b: 部门角色种子数据
-- 前置: 014_add_department_view.sql (role_category 字段已添加)
-- 说明: 插入示例部门角色，用于 Dashboard 部门视图功能
--       实际使用时请根据公司组织架构自行调整
-- ============================================================

-- 插入部门角色（type=2 表示自定义角色，区别于 type=1 系统角色）
INSERT IGNORE INTO `roles` (`name`, `code`, `type`, `platform`, `description`, `sort`, `role_category`) VALUES
('研发部', 'dept_engineering', 2, 'all', '研发工程团队', 10, 'department'),
('产品部', 'dept_product',     2, 'all', '产品设计团队', 20, 'department'),
('运营部', 'dept_operation',   2, 'all', '运营推广团队', 30, 'department'),
('市场部', 'dept_marketing',   2, 'all', '市场营销团队', 40, 'department'),
('设计部', 'dept_design',      2, 'all', 'UI/UX设计团队', 50, 'department');

-- 将现有用户分配到部门角色（示例：随机分配，实际请按需调整）
-- 取前5个活跃用户分配到研发部
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM (SELECT id FROM `users` WHERE status = 1 ORDER BY id LIMIT 5) u
CROSS JOIN (SELECT id FROM `roles` WHERE code = 'dept_engineering') r;

-- 接下来5个用户分配到产品部
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM (SELECT id FROM `users` WHERE status = 1 ORDER BY id LIMIT 5 OFFSET 5) u
CROSS JOIN (SELECT id FROM `roles` WHERE code = 'dept_product') r;

-- 接下来分配到运营部
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT u.id, r.id
FROM (SELECT id FROM `users` WHERE status = 1 ORDER BY id LIMIT 5 OFFSET 10) u
CROSS JOIN (SELECT id FROM `roles` WHERE code = 'dept_operation') r;

-- 校验
-- SELECT r.name, r.code, r.role_category, COUNT(ur.user_id) as member_count
-- FROM roles r LEFT JOIN user_roles ur ON r.id = ur.role_id
-- WHERE r.role_category = 'department'
-- GROUP BY r.id;
