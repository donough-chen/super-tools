import {
  PaymentProvider,
  PrepayInput, PrepayResult,
  VerifyResult,
  QueryStatusOutput,
  RefundInput, RefundResult,
} from './provider';

/**
 * MockProvider — 开发期支付适配器
 *
 * 行为：
 *   - createPrepay: 返回 mockToken + cashierUrl（H5 路由）
 *   - verifyCallback: JSON.parse rawBody，校验 paymentNo + amount，无签名校验
 *   - queryStatus: 始终返回 'pending'（service 直接读 DB 状态）
 *   - refund (Phase 2): 始终成功，fundChange=true（开发期）
 */
export class MockProvider implements PaymentProvider {
  readonly code = 'mock' as const;

  async createPrepay(input: PrepayInput): Promise<PrepayResult> {
    return {
      provider: 'mock',
      prepayData: {
        mockToken: `mock_${input.paymentNo}_${Date.now()}`,
        amount: input.amount,
        subject: input.subject,
      },
      cashierUrl: `/member/cashier?paymentNo=${input.paymentNo}`,
    };
  }

  async verifyCallback(_headers: Record<string, string>, rawBody: string): Promise<VerifyResult> {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return {
        success: false, paymentNo: '', providerTradeNo: '', amount: 0,
        rawPayload: {}, error: 'invalid JSON',
      };
    }
    if (!payload.paymentNo) {
      return {
        success: false, paymentNo: '', providerTradeNo: '', amount: 0,
        rawPayload: payload, error: 'missing paymentNo',
      };
    }
    if (typeof payload.amount !== 'number') {
      return {
        success: false, paymentNo: payload.paymentNo, providerTradeNo: '', amount: 0,
        rawPayload: payload, error: 'missing/invalid amount',
      };
    }
    return {
      success: true,
      paymentNo: payload.paymentNo,
      providerTradeNo: payload.providerTradeNo || `MOCK_${Date.now()}`,
      amount: payload.amount,
      rawPayload: payload,
    };
  }

  async queryStatus(_paymentNo: string): Promise<QueryStatusOutput> {
    // mock 不真实查询，由 service 直接读 DB
    return { status: 'pending', raw: { mocked: true } };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      success: true,
      providerRefundNo: `MOCK_REFUND_${Date.now()}`,
      fundChange: true,
      rawResponse: { mocked: true, ...input },
    };
  }
}
