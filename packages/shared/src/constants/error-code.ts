/**
 * 业务错误码（与 HTTP 状态码分离）
 * code = 0 表示成功；非 0 表示业务错误
 *
 * 命名规范：按错误大类分段，便于前端按区间统一处理
 */
export const ErrorCode = {
  SUCCESS: 0,

  // 鉴权类 1001-1099
  UNAUTHORIZED: 1001, // 未登录或 token 失效
  TOKEN_EXPIRED: 1002, // token 已过期
  FORBIDDEN: 1003, // 无权限访问该资源

  // 参数类 2001-2099
  VALIDATION_FAILED: 2001, // 参数校验失败（data 含字段级错误）
  NOT_FOUND: 2002, // 资源不存在
  CONFLICT: 2003, // 资源冲突（如重复打卡）

  // 限流类 3001-3099
  RATE_LIMITED: 3001, // 请求过于频繁

  // 服务器类 5000-5999
  INTERNAL_ERROR: 5000, // 服务器内部错误
  SERVICE_UNAVAILABLE: 5001, // 服务暂不可用（维护中）
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/** 错误码 → HTTP 状态码 的映射（后端响应时用） */
export const ERROR_HTTP_STATUS: Record<number, number> = {
  [ErrorCode.SUCCESS]: 200,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
}
