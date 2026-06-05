-- 1. 先查看需要同步的数据（验证用）
SELECT 
    mo.order_no, 
    mo.amount as order_amount, 
    mo.actual_amount,
    mp.amount as payment_amount,
    mp.status as payment_status
FROM member_orders mo
LEFT JOIN member_payments mp ON mo.id = mp.order_id AND mp.status = 1
WHERE mo.status = 1 AND mo.actual_amount IS NULL;

-- 2. 同步历史数据：从 member_payments 表获取实际支付金额
UPDATE member_orders mo
JOIN member_payments mp ON mo.id = mp.order_id AND mp.status = 1
SET mo.actual_amount = mp.amount
WHERE mo.status = 1;

-- 3. 处理特殊情况：已支付但没有支付记录的订单（理论上不应存在）
-- 如果有，则使用订单原金额兜底
UPDATE member_orders 
SET actual_amount = amount 
WHERE status = 1 AND actual_amount IS NULL;

-- 4. 验证同步结果
SELECT 
    mo.order_no, 
    mo.amount as order_amount, 
    mo.actual_amount,
    mp.amount as payment_amount
FROM member_orders mo
LEFT JOIN member_payments mp ON mo.id = mp.order_id AND mp.status = 1
WHERE mo.status = 1 
LIMIT 10;

-- 添加 member_payments 表的优惠券关联字段
-- 用于记录支付时使用的优惠券信息

ALTER TABLE member_payments
  ADD COLUMN coupon_id BIGINT UNSIGNED NULL AFTER amount,
  ADD COLUMN coupon_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER coupon_id,
  ADD CONSTRAINT fk_member_payments_coupon_id FOREIGN KEY (coupon_id) REFERENCES user_coupons(id) ON DELETE SET NULL;

-- 说明：
-- 1. coupon_id: 使用的优惠券ID，关联 user_coupons.id
-- 2. coupon_discount_amount: 优惠券抵扣金额
