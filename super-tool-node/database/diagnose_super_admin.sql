-- 诊断 1：是否存在 super_admin 角色？
SELECT id, code, name, type FROM roles WHERE code = 'super_admin';

-- 诊断 2：所有系统角色
SELECT id, code, name, type FROM roles WHERE type = 1;

-- 诊断 3：admin 用户存在吗？
SELECT id, username, user_type, status FROM users WHERE username = 'admin';

-- 诊断 4：admin 用户当前绑定了哪些角色？
SELECT u.id, u.username, u.user_type, r.id AS role_id, r.code AS role_code, r.name AS role_name
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.username = 'admin';

-- 诊断 5：所有 user_type=3 的用户
SELECT id, username, user_type, status FROM users WHERE user_type = 3;