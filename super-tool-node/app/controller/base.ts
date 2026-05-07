import { Controller } from 'egg';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
}

export default class BaseController extends Controller {
  /**
   * 成功响应
   */
  protected success<T>(data?: T, message: string = 'success'): void {
    this.ctx.body = {
      code: 200,
      message,
      data,
      timestamp: Date.now(),
    } as ApiResponse<T>;
    this.ctx.status = 200;
  }

  /**
   * 创建成功响应
   */
  protected created<T>(data?: T, message: string = '创建成功'): void {
    this.ctx.body = {
      code: 201,
      message,
      data,
      timestamp: Date.now(),
    } as ApiResponse<T>;
    this.ctx.status = 201;
  }

  /**
   * 分页响应
   */
  protected paginated<T>(result: any, message: string = 'success'): void {
    this.ctx.body = {
      code: 200,
      message,
      data: result,
      timestamp: Date.now(),
    };
    this.ctx.status = 200;
  }

  /**
   * 参数验证
   */
  protected validate(rules: object): void {
    const errors = (this.app as any).validator.validate(
      rules,
      this.ctx.request.body,
    );
    if (errors) {
      this.ctx.throw(422, '参数验证失败', { errors });
    }
  }

  /**
   * 获取分页参数
   */
  protected getPagination() {
    const { page = '1', pageSize = '20' } = this.ctx.query;
    return {
      page: Math.max(1, Number(page)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize))),
    };
  }
}
