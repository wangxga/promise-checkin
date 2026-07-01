/**
 * @promise-checkin/shared
 * 前后端共享的契约层：类型、枚举、常量
 *
 * 设计原则：
 * - 只放纯类型和常量，零运行时业务逻辑
 * - 不依赖任何运行时库（可在前端/后端/Node 任意环境 import）
 * - 实体类型 = 数据库形态；DTO = 接口请求/响应形态
 * - 枚举用 const enum 的替代（普通 enum），兼容 uni-app 编译
 *
 * 用法：
 *   import { Plan, CheckinStatus, ErrorCode } from '@promise-checkin/shared'
 *   import type { LoginInput } from '@promise-checkin/shared/types'
 */

export * from './enums'
export * from './constants'
export * from './types'
