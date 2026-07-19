import type { ErrorCode } from '../constants/error-code.js'

/**
 * 统一 API 响应格式
 * - code = 0 成功；非 0 业务错误
 * - data 可为对象/数组/null
 */
export interface ApiResponse<T = unknown> {
  code: typeof ErrorCode.SUCCESS | number
  message: string
  data: T
}

/** 分页列表响应 */
export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 字段级校验错误（code = VALIDATION_FAILED 时，data 用此结构） */
export interface FieldErrors {
  [field: string]: string
}
