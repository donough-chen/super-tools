import { Service } from 'egg';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  order?: [string, 'ASC' | 'DESC'][];
}

export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default class BaseService extends Service {
  /**
   * 分页查询封装
   */
  protected async paginate<T>(
    model: any,
    options: any,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<T>> {
    const appConfig = (this.app.config as any).appConfig || {};
    const {
      page = 1,
      pageSize = appConfig.pageSize || 20,
      order = [['created_at', 'DESC']],
    } = pagination;

    const maxPageSize = appConfig.maxPageSize || 100;
    const limit = Math.min(pageSize, maxPageSize);
    const offset = (page - 1) * limit;

    const { count, rows } = await model.findAndCountAll({
      ...options,
      limit,
      offset,
      order,
    });

    return {
      list: rows,
      total: count,
      page,
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Redis 缓存封装
   */
  protected async getOrSetCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300,
  ): Promise<T> {
    try {
      const cached = await this.app.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Redis 不可用时直接走数据库
    }

    const data = await fetchFn();

    try {
      await this.app.redis.setex(key, ttl, JSON.stringify(data));
    } catch {
      // Redis 写入失败不影响主流程
    }

    return data;
  }

  /**
   * 清除缓存
   */
  protected async clearCache(pattern: string): Promise<void> {
    try {
      const keys = await this.app.redis.keys(pattern);
      if (keys.length > 0) {
        await this.app.redis.del(...keys);
      }
    } catch {
      // Redis 不可用时跳过
    }
  }
}
