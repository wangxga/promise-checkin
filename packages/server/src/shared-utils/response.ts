import type { Context } from 'koa'
import { ErrorCode, type ApiResponse } from '@promise-checkin/shared'

/**
 * 统一响应工具
 * Controller 用 ok(data) / err(code, msg) 输出，保证全站响应格式一致
 */

/** 成功响应 */
export function ok<T>(ctx: Context, data: T, message = 'ok'): void {
  const body: ApiResponse<T> = { code: ErrorCode.SUCCESS, message, data }
  ctx.body = body
}

/** 直接返回成功体（不写 ctx，用于非 Koa 场景如定时任务日志） */
export function okBody<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: ErrorCode.SUCCESS, message, data }
}
