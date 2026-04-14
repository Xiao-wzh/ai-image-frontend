/**
 * Analytics 查询内存缓存
 *
 * 目的：防止管理后台 analytics 页面的重量级查询反复执行，拖垮正常用户服务。
 *
 * - 默认缓存 5 分钟，避免管理员短时间内重复访问导致数据库压力
 * - 每个 cache key 独立过期
 * - 纯内存缓存，无需 Redis（analytics 数据不需要跨实例共享）
 */

type CacheEntry<T> = {
  data: T
  expireAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** 带缓存的查询，cacheKey 相同时直接返回缓存结果 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlMs = 5 * 60 * 1000 // 默认 5 分钟
): Promise<T> {
  const cached = store.get(cacheKey)
  if (cached && Date.now() < cached.expireAt) {
    return cached.data as T
  }

  const data = await queryFn()
  store.set(cacheKey, { data, expireAt: Date.now() + ttlMs })
  return data
}

/** 清除所有缓存（用于手动刷新时调用） */
export function clearAnalyticsCache() {
  store.clear()
}
