import type { Context, Next } from 'koa'
import { logger } from '../lib/logger.js'

/**
 * 请求日志中间件
 * 记录方法、路径、状态码、耗时
 */
export async function requestLogger(ctx: Context, next: Next): Promise<void> {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  logger.info(
    {
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      ms,
    },
    `${ctx.method} ${ctx.path} ${ctx.status} ${ms}ms`,
  )
}
