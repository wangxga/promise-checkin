import { z } from 'zod'
import { BUSINESS_DEFAULTS } from '@promise-checkin/shared'

/**
 * Auth 模块的 zod schema（参数校验 + 类型推导单一来源）
 * z.infer 推导出的类型即为请求体类型，不重复手写
 */

/** POST /auth/login */
export const loginSchema = z.object({
  code: z.string().min(1, 'code 不能为空'),
  nickname: z.string().max(BUSINESS_DEFAULTS.PLAN_NAME_MAX_LENGTH).optional(),
  avatarUrl: z.string().url().max(512).optional(),
})
export type LoginDTO = z.infer<typeof loginSchema>

/** POST /auth/refresh */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})
export type RefreshDTO = z.infer<typeof refreshSchema>
