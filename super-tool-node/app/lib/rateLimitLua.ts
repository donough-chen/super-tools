/**
 * Redis Lua 脚本：原子计数 + 过期判定
 *
 * KEYS[1] = 频控 key
 * ARGV[1] = 窗口秒数
 * ARGV[2] = 最大次数
 *
 * 返回：
 * [0, currentCount] = 未命中限制
 * [1, currentCount] = 已命中限制
 */
export const RATE_LIMIT_LUA = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local maxCount = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key) or '0')
if current >= maxCount then
  return {1, current}
end

current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
end

if current > maxCount then
  return {1, current}
end

return {0, current}
`;
