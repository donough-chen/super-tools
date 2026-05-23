# ==============================================================================
# 会员套餐订阅与支付 MVP — 端到端 smoke 脚本
# ------------------------------------------------------------------------------
# 用法：
#   PS> Set-Location 'd:\Donough\Projects\super-tools\super-tool-node'
#   PS> powershell -ExecutionPolicy Bypass -File scripts\smoke-member-subscription.ps1
#
# 前置条件：
#   - 后端 dev 已启动（http://localhost:7001）
#   - 021/022/023 SQL 迁移已执行
#   - 数据库内有 admin 账号（密码 Admin@123456）+ design5@163.com 用户
#   - 套餐 monthly / yearly 已存在 paid_plans
# ==============================================================================

$ErrorActionPreference = 'Continue'

$BASE = 'http://localhost:7001'
$ADMIN_USER = 'admin'
$ADMIN_PASS = 'Admin@123456'
$ADMIN_CLIENT_ID = 'admin_client'
$ADMIN_CLIENT_SECRET = 'ADMIN_SECRET'

# H5 普通用户
$H5_USER = 'design5@163.com'
$H5_PASS = 'User@123456'
$H5_CLIENT_ID = 'h5_client'
$H5_CLIENT_SECRET = 'H5_SECRET'

function Step($title) {
  Write-Host ""
  Write-Host "=== $title ===" -ForegroundColor Cyan
}
function Ok($msg)   { Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# -------------------------------------------------------------
# 0. 登录
# -------------------------------------------------------------
Step "0a. admin 登录"
$adminBody = @{ username = $ADMIN_USER; password = $ADMIN_PASS; clientId = $ADMIN_CLIENT_ID; clientSecret = $ADMIN_CLIENT_SECRET } | ConvertTo-Json
$adminLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body $adminBody -ContentType "application/json"
$adminToken = $adminLogin.data.accessToken
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
Ok "adminToken=$($adminToken.Substring(0,20))..."

Step "0b. h5 普通用户登录"
$uBody = @{ username = $H5_USER; password = $H5_PASS; clientId = $H5_CLIENT_ID; clientSecret = $H5_CLIENT_SECRET } | ConvertTo-Json
$uLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body $uBody -ContentType "application/json"
$uToken = $uLogin.data.accessToken
$uHeaders = @{ Authorization = "Bearer $uToken" }
$uJson = @{ Authorization = "Bearer $uToken"; "Content-Type" = "application/json" }
Ok "uToken=$($uToken.Substring(0,20))..."

# -------------------------------------------------------------
# 0c. 预清理：取消未支付订单
# -------------------------------------------------------------
Step "0c. 预清理未支付订单"
try {
  $existPending = Invoke-RestMethod -Uri ($BASE + '/api/orders?status=0&page=1&pageSize=20') -Headers $uHeaders
  foreach ($o in $existPending.data.list) {
    Invoke-RestMethod -Uri "$BASE/api/orders/$($o.id)/cancel" -Method POST -Headers $uHeaders | Out-Null
    Ok "cancelled #$($o.id) ($($o.orderNo))"
  }
  if ($existPending.data.list.Count -eq 0) { Ok "no pending orders" }
} catch { Warn "cleanup skipped: $($_.Exception.Message)" }

# -------------------------------------------------------------
# 1. 创建订单
# -------------------------------------------------------------
Step "1. 创建订单 (monthly)"
$createRes = Invoke-RestMethod -Uri "$BASE/api/orders" -Method POST -Headers $uJson -Body '{"planCode":"monthly"}'
$orderId = $createRes.data.orderId
$orderNo = $createRes.data.orderNo
Ok "orderId=$orderId orderNo=$orderNo amount=$($createRes.data.amount)"

# -------------------------------------------------------------
# 2. 创建支付
# -------------------------------------------------------------
Step "2. 创建支付 (mock)"
$payRes = Invoke-RestMethod -Uri "$BASE/api/payments" -Method POST -Headers $uJson -Body "{`"orderId`":$orderId,`"provider`":`"mock`"}"
$paymentNo = $payRes.data.paymentNo
Ok "paymentNo=$paymentNo"

# -------------------------------------------------------------
# 3. Mock 回调成功
# -------------------------------------------------------------
Step "3. Mock 回调成功"
$amount = $createRes.data.amount
$cbBody = "{`"paymentNo`":`"$paymentNo`",`"amount`":$amount}"
$cb1 = Invoke-RestMethod -Uri "$BASE/api/payments/mock/notify" -Method POST -Body $cbBody -ContentType "application/json"
Ok "callback code=$($cb1.code) skipped=$($cb1.data.skipped)"

# -------------------------------------------------------------
# 4. 查支付状态
# -------------------------------------------------------------
Step "4. 查支付状态 (预期 status=1)"
$pst = Invoke-RestMethod -Uri "$BASE/api/payments/$paymentNo/status" -Headers $uHeaders
if ($pst.data.status -eq 1) { Ok "payment.status = 1" } else { Err "payment.status = $($pst.data.status)" }

# -------------------------------------------------------------
# 5. 查订单详情
# -------------------------------------------------------------
Step "5. 查订单详情 (预期 status=1)"
$od = (Invoke-RestMethod -Uri "$BASE/api/orders/$orderId" -Headers $uHeaders).data
if ($od.status -eq 1) { Ok "order.status = 1 paidAt=$($od.paidAt)" } else { Err "order.status = $($od.status)" }

# -------------------------------------------------------------
# 6. 查会员状态
# -------------------------------------------------------------
Step "6. 查会员状态 (预期 isPaid=true)"
$mi = (Invoke-RestMethod -Uri "$BASE/api/member/info" -Headers $uHeaders).data
if ($mi.paid.isPaid) { Ok "isPaid=true planName=$($mi.paid.planName) remainingDays=$($mi.paid.remainingDays)" } else { Err "isPaid=false" }

# -------------------------------------------------------------
# 7. 重复回调幂等
# -------------------------------------------------------------
Step "7. 重复回调幂等 (预期 skipped=true)"
$cb2 = Invoke-RestMethod -Uri "$BASE/api/payments/mock/notify" -Method POST -Body $cbBody -ContentType "application/json"
if ($cb2.data.skipped) { Ok "skipped=true" } else { Err "skipped=false" }

# -------------------------------------------------------------
# 8. 跨套餐购买拦截
# -------------------------------------------------------------
Step "8. 跨套餐购买拦截 (预期 400)"
try {
  Invoke-RestMethod -Uri "$BASE/api/orders" -Method POST -Headers $uJson -Body '{"planCode":"yearly"}' | Out-Null
  Err "未拦截，预期 400"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 400) { Ok "400 $($_.ErrorDetails.Message)" } else { Err "非预期错误码 $code" }
}

# -------------------------------------------------------------
# 9. 同套餐续费 (预期 scene=2)
# -------------------------------------------------------------
Step "9. 同套餐续费 (预期 scene=2)"
$renew = Invoke-RestMethod -Uri "$BASE/api/orders" -Method POST -Headers $uJson -Body '{"planCode":"monthly"}'
if ($renew.data.scene -eq 2) { Ok "scene=2 orderId=$($renew.data.orderId)" } else { Err "scene=$($renew.data.scene)" }
$renewOrderId = $renew.data.orderId

# -------------------------------------------------------------
# 10. 取消续费订单
# -------------------------------------------------------------
Step "10. 取消续费订单 #$renewOrderId"
$cancel = Invoke-RestMethod -Uri "$BASE/api/orders/$renewOrderId/cancel" -Method POST -Headers $uHeaders
Ok "cancelled status=$($cancel.data.status)"

# -------------------------------------------------------------
# 11. 我的订单列表
# -------------------------------------------------------------
Step "11. 我的订单列表"
$list = (Invoke-RestMethod -Uri ($BASE + '/api/orders?page=1&pageSize=10') -Headers $uHeaders).data
Ok "total=$($list.total) returned=$($list.list.Count)"

# -------------------------------------------------------------
# 12. 管理端订单统计
# -------------------------------------------------------------
Step "12. 管理端订单统计"
$stats = (Invoke-RestMethod -Uri "$BASE/api/admin/member/orders/stats" -Headers $adminHeaders).data
Ok "totalOrders=$($stats.totalOrders) paidOrders=$($stats.paidOrders) payRate=$($stats.payRate) totalRevenue=$($stats.totalRevenue)"

# -------------------------------------------------------------
# 13. 通知列表
# -------------------------------------------------------------
Step "13. 通知列表"
$nots = (Invoke-RestMethod -Uri ($BASE + '/api/notifications?page=1&pageSize=10') -Headers $uHeaders).data
$nots.list | Select-Object id, typeCode, title | Format-Table -AutoSize

Write-Host ""
Write-Host "=== smoke done ===" -ForegroundColor Cyan
