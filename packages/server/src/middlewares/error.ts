import type { Context, Next } from 'koa'
import { ZodError } from 'zod'
import { BusinessError } from '../shared-utils/errors.js'
import { logger } from '../lib/logger.js'
import {
  ErrorCode,
  ERROR_HTTP_STATUS,
  type ApiResponse,
} from '@promise-checkin/shared'

/**
 * 全局错误兜底中间件
 * - BusinessError：按错误码转统一响应
 * - ZodError：转成字段级校验错误
 * - 其他未知错误：转 500，生产环境不返回堆栈
 */
export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next()
  } catch (err) {
    let code: number = ErrorCode.INTERNAL_ERROR
    let message = '服务器内部错误'
    let fields: Record<string, string> | undefined
    let httpStatus = 500

    if (err instanceof BusinessError) {
      code = err.code
      message = err.message
      fields = err.fields
      httpStatus = ERROR_HTTP_STATUS[code] ?? 500
    } else if (err instanceof ZodError) {
      code = ErrorCode.VALIDATION_FAILED
      message = '参数校验失败'
      fields = Object.fromEntries(
        err.issues.map((i) => [i.path.join('.'), i.message]),
      )
      httpStatus = 400
    } else if (err instanceof Error) {
      message = err.message
      logger.error({ err }, '[unhandled] 未捕获错误')
    } else {
      logger.error({ err: String(err) }, '[unhandled] 未知错误类型')
    }

    ctx.status = httpStatus
    const body: ApiResponse<null | Record<string, string>> = {
      code,
      message,
      data: fields ?? null,
    }
    ctx.body = body
  }
}
