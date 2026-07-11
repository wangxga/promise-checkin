import type { Context, Next } from 'koa'
import { getRedis } from '../lib/redis.js'
import { BusinessError } from '../shared-utils/errors.js'
import { ErrorCode } from '@promise-checkin/shared'

/**
 * 接口限流中间件（Redis 滑窗计数）
 * - 单 IP 每分钟 60 次，超限返回 3001
 * - Redis 不可用时降级放行（不阻塞业务）
 */
const WINDOW_SECONDS = 60
const MAX_REQUESTS = 60

export async function rateLimit(ctx: Context, next: Next): Promise<void> {
  const ip = (ctx.headers['x-real-ip'] as string) || ctx.ip || 'unknown'
  const key = `ratelimit:${ip}`

  try {
    const redis = getRedis()
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS)
    }
    if (count > MAX_REQUESTS) {
      throw BusinessError.validation({}, '请求过于频繁，请稍后再试')
    }
  } catch (err) {
    // 如果是限流触发的业务错误，正常抛出
    if (err instanceof BusinessError) throw err
    // Redis 不可用，降级放行
  }

  await next()
}
