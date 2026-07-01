import { ErrorCode, type ErrorCodeValue } from '@promise-checkin/shared'

/**
 * 业务错误类
 * Service 层抛出，全局 error 中间件 catch 后转成统一响应格式
 * Controller 层零 try-catch 样板
 */
export class BusinessError extends Error {
  /** 业务错误码（见 ErrorCode 枚举） */
  readonly code: ErrorCodeValue
  /** 字段级错误（仅 VALIDATION_FAILED 时有） */
  readonly fields?: Record<string, string>

  constructor(
    code: ErrorCodeValue,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
    this.fields = fields
  }

  /** 快捷工厂方法 */
  static unauthorized(msg = '未登录或 token 失效') {
    return new BusinessError(ErrorCode.UNAUTHORIZED, msg)
  }
  static forbidden(msg = '无权限访问该资源') {
    return new BusinessError(ErrorCode.FORBIDDEN, msg)
  }
  static notFound(msg = '资源不存在') {
    return new BusinessError(ErrorCode.NOT_FOUND, msg)
  }
  static conflict(msg = '资源冲突') {
    return new BusinessError(ErrorCode.CONFLICT, msg)
  }
  static validation(fields: Record<string, string>, msg = '参数校验失败') {
    return new BusinessError(ErrorCode.VALIDATION_FAILED, msg, fields)
  }
  static internal(msg = '服务器内部错误') {
    return new BusinessError(ErrorCode.INTERNAL_ERROR, msg)
  }
}
