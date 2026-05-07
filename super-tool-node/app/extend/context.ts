export default {
  /**
   * 获取客户端真实 IP
   */
  get realIp(): string {
    return (
      (this as any).get('x-forwarded-for')?.split(',')[0]?.trim() ||
      (this as any).get('x-real-ip') ||
      (this as any).ip
    );
  },

  /**
   * 判断是否为 Ajax 请求
   */
  get isAjax(): boolean {
    return (this as any).get('x-requested-with') === 'XMLHttpRequest';
  },

  /**
   * 获取当前登录用户 ID
   */
  get currentUserId(): number | null {
    return (this as any).state.user?.id || null;
  },
};
