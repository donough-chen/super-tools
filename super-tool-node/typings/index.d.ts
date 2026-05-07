import 'egg';

declare module 'egg' {
  interface Application {
    redis: any;
    jwt: any;
    Sequelize: any;
    model: any;
  }

  interface Context {
    model: any;
    state: {
      user?: { id: number; uuid: string; username: string; userType: number; type: string };
      token?: string;
      sessionId?: string;
      [key: string]: any;
    };
  }

  interface IService {
    user: any;
    auth: any;
    cache: any;
    base: any;
    role: any;
    permission: any;
    tool: any;
  }

  interface IController {
    auth: any;
    user: any;
    admin: {
      dashboard: any;
      role: any;
      permission: any;
      member: any;
      tool: any;
    };
    member: any;
    tool: any;
  }

  interface EggAppConfig {
    sequelize: any;
    redis: any;
    jwt: any;
    cors: any;
    validate: any;
    appConfig: {
      pageSize: number;
      maxPageSize: number;
      tokenBlacklistPrefix: string;
      rateLimitPrefix: string;
    };
  }
}
