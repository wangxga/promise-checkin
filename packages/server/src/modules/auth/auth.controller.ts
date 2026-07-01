import Router from '@koa/router'
import type { Context } from 'koa'
import { loginSchema, refreshSchema } from './auth.dto.js'
import * as authService from './auth.service.js'
import { ok } from '../../shared-utils/response.js'
import { BusinessError } from '../../shared-utils/errors.js'

/**
 * Auth Controller — HTTP 层
 * 职责：路由定义、参数校验（zod）、调 Service、包装响应
 * 不含业务逻辑，不直接访问数据库
 *
 * 路由挂载在 /api/v1/auth 下（前缀由 routes/index.ts 决定）
 */
export const authRouter = new Router({ prefix: '/auth' })

/** POST /auth/login — 微信登录 */
authRouter.post('/login', async (ctx: Context) => {
  const parsed = loginSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const result = await authService.login(parsed.data)
  ok(ctx, result)
})

/** POST /auth/refresh — 刷新 token */
authRouter.post('/refresh', async (ctx: Context) => {
  const parsed = refreshSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const result = await authService.refresh(parsed.data.refreshToken)
  ok(ctx, result)
})

/** GET /auth/me — 当前用户 */
authRouter.get('/me', async (ctx: Context) => {
  const userId = ctx.state.userId as number
  const user = await authService.getMe(userId)
  ok(ctx, user)
})
