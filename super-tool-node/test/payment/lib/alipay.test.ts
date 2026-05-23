/**
 * AlipayProvider 单测
 *
 * jest.mock alipay-sdk 让构造不要真连网；只验证我们对 SDK 的调用 + 返回适配逻辑
 */

// mock 必须在 import 之前生效
const mockSdkInstance = {
  pageExec: jest.fn(),
  checkNotifySignV2: jest.fn(),
  exec: jest.fn(),
};

jest.mock('alipay-sdk', () => ({
  AlipaySdk: jest.fn().mockImplementation(() => mockSdkInstance),
}));

import { AlipayProvider } from '../../../app/lib/payment/alipay';

const baseCfg = {
  appId: '2021000_test',
  privateKey: 'fake-private-key',
  alipayPublicKey: 'fake-alipay-public-key',
  gateway: 'https://openapi.alipaydev.com/gateway.do',
  signType: 'RSA2' as const,
  notifyUrl: 'https://example.com/notify',
  returnUrl: 'https://example.com/return',
};

describe('AlipayProvider', () => {
  beforeEach(() => {
    mockSdkInstance.pageExec.mockReset();
    mockSdkInstance.checkNotifySignV2.mockReset();
    mockSdkInstance.exec.mockReset();
  });

  it('构造缺必要配置时抛错', () => {
    expect(() => new AlipayProvider({ ...baseCfg, appId: '' } as any)).toThrow(/缺少必要配置/);
    expect(() => new AlipayProvider({ ...baseCfg, privateKey: '' } as any)).toThrow();
    expect(() => new AlipayProvider({ ...baseCfg, alipayPublicKey: '' } as any)).toThrow();
  });

  it('createPrepay 调 pageExec 拿 cashierUrl', async () => {
    mockSdkInstance.pageExec.mockReturnValue('https://openapi.alipaydev.com/gateway.do?biz_content=xxx&sign=yyy');
    const p = new AlipayProvider(baseCfg);
    const out = await p.createPrepay({
      paymentNo: 'MP_TEST_1',
      amount: 6.8,
      subject: '月度会员订阅',
      planName: '月度会员',
      userId: 1,
      notifyUrl: 'https://example.com/notify',
    });
    expect(out.cashierUrl).toMatch(/openapi\.alipaydev\.com/);
    expect(out.provider).toBe('alipay');
    expect(out.prepayData.url).toBeTruthy();
    // 验证调用参数
    expect(mockSdkInstance.pageExec).toHaveBeenCalledWith(
      'alipay.trade.wap.pay',
      expect.objectContaining({
        method: 'GET',
        bizContent: expect.objectContaining({
          out_trade_no: 'MP_TEST_1',
          total_amount: '6.80',
          product_code: 'QUICK_WAP_WAY',
        }),
      }),
    );
  });

  it('verifyCallback 验签失败返回 success=false', async () => {
    mockSdkInstance.checkNotifySignV2.mockReturnValue(false);
    const p = new AlipayProvider(baseCfg);
    const out = await p.verifyCallback(
      {},
      'out_trade_no=MP1&trade_status=TRADE_SUCCESS&trade_no=T123&total_amount=6.80',
    );
    expect(out.success).toBe(false);
    expect(out.error).toBe('signature mismatch');
  });

  it('verifyCallback 验签成功 + trade_status=TRADE_SUCCESS 返回 success=true', async () => {
    mockSdkInstance.checkNotifySignV2.mockReturnValue(true);
    const p = new AlipayProvider(baseCfg);
    const out = await p.verifyCallback(
      {},
      'out_trade_no=MP1&trade_status=TRADE_SUCCESS&trade_no=T123&total_amount=6.80',
    );
    expect(out.success).toBe(true);
    expect(out.paymentNo).toBe('MP1');
    expect(out.providerTradeNo).toBe('T123');
    expect(out.amount).toBe(6.8);
  });

  it('verifyCallback trade_status 异常返回 success=false', async () => {
    mockSdkInstance.checkNotifySignV2.mockReturnValue(true);
    const p = new AlipayProvider(baseCfg);
    const out = await p.verifyCallback(
      {},
      'out_trade_no=MP1&trade_status=WAIT_BUYER_PAY&trade_no=T123&total_amount=6.80',
    );
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/bad trade_status/);
  });

  it('queryStatus 映射 4 个状态', async () => {
    const p = new AlipayProvider(baseCfg);
    const cases: Array<{ tradeStatus: string; expected: 'success' | 'pending' | 'failed' | 'unknown' }> = [
      { tradeStatus: 'TRADE_SUCCESS', expected: 'success' },
      { tradeStatus: 'TRADE_FINISHED', expected: 'success' },
      { tradeStatus: 'WAIT_BUYER_PAY', expected: 'pending' },
      { tradeStatus: 'TRADE_CLOSED', expected: 'failed' },
      { tradeStatus: 'UNKNOWN_STATUS', expected: 'unknown' },
    ];
    for (const c of cases) {
      mockSdkInstance.exec.mockResolvedValueOnce({
        code: '10000',
        msg: 'Success',
        tradeStatus: c.tradeStatus,
        tradeNo: 'T1',
        totalAmount: '6.80',
      });
      const out = await p.queryStatus('MP1');
      expect(out.status).toBe(c.expected);
    }
  });

  it('queryStatus code 非 10000 返回 unknown', async () => {
    mockSdkInstance.exec.mockResolvedValueOnce({ code: '40004', msg: 'Business Failed' });
    const p = new AlipayProvider(baseCfg);
    const out = await p.queryStatus('MP1');
    expect(out.status).toBe('unknown');
  });

  it('refund 成功返回 fundChange=true', async () => {
    mockSdkInstance.exec.mockResolvedValueOnce({
      code: '10000',
      msg: 'Success',
      tradeNo: 'T1',
      fundChange: 'Y',
      refundFee: '6.80',
    });
    const p = new AlipayProvider(baseCfg);
    const out = await p.refund({
      paymentNo: 'MP1',
      refundNo: 'RF1',
      amount: 6.8,
      totalAmount: 6.8,
      reason: '测试退款',
    });
    expect(out.success).toBe(true);
    expect(out.fundChange).toBe(true);
    expect(out.providerRefundNo).toBe('T1');
    // 验证调用参数（验金额格式化）
    expect(mockSdkInstance.exec).toHaveBeenCalledWith(
      'alipay.trade.refund',
      expect.objectContaining({
        bizContent: expect.objectContaining({
          out_trade_no: 'MP1',
          out_request_no: 'RF1',
          refund_amount: '6.80',
          refund_reason: '测试退款',
        }),
      }),
    );
  });

  it('refund 失败返回 failedReason', async () => {
    mockSdkInstance.exec.mockResolvedValueOnce({
      code: '40004',
      msg: 'Business Failed',
      subMsg: '余额不足',
    });
    const p = new AlipayProvider(baseCfg);
    const out = await p.refund({
      paymentNo: 'MP1',
      refundNo: 'RF1',
      amount: 6.8,
      totalAmount: 6.8,
    });
    expect(out.success).toBe(false);
    expect(out.fundChange).toBe(false);
    expect(out.failedReason).toBe('余额不足');
  });
});
