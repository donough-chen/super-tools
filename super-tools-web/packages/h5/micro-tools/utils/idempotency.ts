/**
 * 幂等键生成 — RFC 4122 v4 简化实现
 *
 * 写入接口（签到/领取/兑换）必须携带 Idempotency-Key 头。
 * 24h 内同 key 重放后端会返回首次响应（响应头 x-idempotent-replayed: true）。
 *
 * 不依赖 crypto API（兼容 H5 内嵌环境与老浏览器）。
 *
 * Spec: super-tool-node/docs/superpowers/specs/2026-05-29-积分成长体系H5页面-design.md §4.1
 * Plan: super-tool-node/docs/superpowers/plans/2026-05-29-积分成长体系H5页面实施计划.md (Task 1.2)
 */
export const genIdemKey = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};
