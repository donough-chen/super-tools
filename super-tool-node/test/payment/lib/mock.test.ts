/**
 * MockProvider 单测
 *
 * 路径约定：项目 jest.config.ts 配置 roots = ['<rootDir>/test']，故测试统一放在 test/ 下
 */
import { MockProvider } from '../../../app/lib/payment/mock';

describe('MockProvider', () => {
  const mock = new MockProvider();

  it('createPrepay returns mockToken + cashierUrl', async () => {
    const result = await mock.createPrepay({
      paymentNo: 'MP_TEST_1',
      amount: 6.8,
      subject: '月度会员订阅',
      userId: 1,
      notifyUrl: 'http://localhost:7001/api/payments/mock/notify',
    });
    expect(result.prepayData.mockToken).toMatch(/^mock_MP_TEST_1_/);
    expect(result.prepayData.amount).toBe(6.8);
    expect(result.prepayData.subject).toBe('月度会员订阅');
    expect(result.cashierUrl).toBe('/member/cashier?paymentNo=MP_TEST_1');
  });

  it('verifyCallback success on valid payload', async () => {
    const body = JSON.stringify({ paymentNo: 'MP_T1', amount: 6.8, providerTradeNo: 'WX_123' });
    const result = await mock.verifyCallback({}, body);
    expect(result.success).toBe(true);
    expect(result.paymentNo).toBe('MP_T1');
    expect(result.amount).toBe(6.8);
    expect(result.providerTradeNo).toBe('WX_123');
  });

  it('verifyCallback fails on invalid JSON', async () => {
    const result = await mock.verifyCallback({}, 'not_json');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid JSON');
  });

  it('verifyCallback fails on missing paymentNo', async () => {
    const result = await mock.verifyCallback({}, JSON.stringify({ amount: 1 }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('missing paymentNo');
  });

  it('verifyCallback fails on missing amount', async () => {
    const result = await mock.verifyCallback({}, JSON.stringify({ paymentNo: 'X' }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('missing/invalid amount');
  });

  it('verifyCallback auto-generates providerTradeNo when omitted', async () => {
    const result = await mock.verifyCallback({}, JSON.stringify({ paymentNo: 'X', amount: 1 }));
    expect(result.success).toBe(true);
    expect(result.providerTradeNo).toMatch(/^MOCK_\d+$/);
  });

  it('queryStatus always returns pending', async () => {
    const result = await mock.queryStatus('any');
    expect(result.status).toBe('pending');
  });

  it('refund returns success with mock fundChange=true', async () => {
    const result = await mock.refund({
      paymentNo: 'MP_T1',
      refundNo: 'RF_T1',
      amount: 6.8,
      totalAmount: 6.8,
    });
    expect(result.success).toBe(true);
    expect(result.fundChange).toBe(true);
    expect(result.providerRefundNo).toMatch(/^MOCK_REFUND_\d+$/);
  });
});
