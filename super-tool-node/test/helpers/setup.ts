import mm, { MockApplication } from 'egg-mock';

let app: MockApplication;
let _adminLoginPromise: Promise<string> | null = null;

/**
 * 获取测试应用实例（单例）
 */
export function getApp(): MockApplication {
  if (!app) {
    app = mm.app({
      baseDir: process.cwd(),
      framework: require.resolve('egg'),
    });
  }
  return app;
}

/**
 * 确保管理员已登录，返回 adminToken（全局只登录一次，避免并发导致 token 唯一约束冲突）
 */
export async function ensureAdminLogin(appInstance: MockApplication): Promise<string> {
  if (testCtx.adminToken) return testCtx.adminToken;

  if (!_adminLoginPromise) {
    _adminLoginPromise = (async () => {
      const res = await appInstance.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      const token = res.body.data?.accessToken || '';
      if (!token) {
        throw new Error(`管理员登录失败: ${JSON.stringify(res.body)}`);
      }
      testCtx.adminToken = token;
      testCtx.refreshToken = res.body.data?.refreshToken || '';
      return token;
    })();
  }

  return _adminLoginPromise;
}

/**
 * 测试上下文：存储跨用例共享的状态（token、id 等）
 */
export const testCtx: {
  adminToken: string;
  userToken: string;
  refreshToken: string;
  createdUserId: number;
  createdRoleId: number;
  createdPermissionId: number;
  createdChildPermissionId: number;
  createdAddressId: number;
  sessionId: string;
} = {
  adminToken: '',
  userToken: '',
  refreshToken: '',
  createdUserId: 0,
  createdRoleId: 0,
  createdPermissionId: 0,
  createdChildPermissionId: 0,
  createdAddressId: 0,
  sessionId: '',
};

/** 测试用的 clientId / clientSecret（对应数据库中已有的应用记录） */
export const TEST_CLIENT = {
  clientId: 'web_client',
  clientSecret: 'CHANGE_ME_WEB_SECRET',
};

/** 测试管理员账号 */
export const TEST_ADMIN = {
  username: 'admin',
  password: 'Admin@123456',
};

/** 测试普通用户账号（注册后使用） */
export const TEST_USER = {
  username: `testuser_${Date.now()}`,
  email: `testuser_${Date.now()}@example.com`,
  password: 'Test@123456',
  nickname: '测试用户',
};

/**
 * 断言响应为成功格式
 */
export function assertSuccess(body: any, expectedCode = 200) {
  if (body.code !== expectedCode) {
    throw new Error(
      `期望 code=${expectedCode}，实际 code=${body.code}，message=${body.message}`
    );
  }
  if (typeof body.timestamp !== 'number') {
    throw new Error('响应缺少 timestamp 字段');
  }
}

/**
 * 断言响应包含分页数据
 */
export function assertPaginated(body: any) {
  assertSuccess(body);
  const data = body.data;
  if (!data || typeof data.total !== 'number' || !Array.isArray(data.list)) {
    throw new Error(
      `分页响应格式错误：${JSON.stringify(data)}`
    );
  }
}

/**
 * 断言响应为错误格式
 */
export function assertError(body: any, expectedStatus: number) {
  if (body.status !== expectedStatus && body.code !== expectedStatus) {
    throw new Error(
      `期望错误状态 ${expectedStatus}，实际：${JSON.stringify(body)}`
    );
  }
}
