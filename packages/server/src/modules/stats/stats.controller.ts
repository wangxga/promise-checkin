import Router from '@koa/router'
import type { Context } from 'koa'
import { z } from 'zod'
import * as statsService from './stats.service.js'
import { ok } from '../../shared-utils/response.js'
import { BusinessError } from '../../shared-utils/errors.js'

/**
 * Stats Controller — 统计路由
 */
export const statsRouter = new Router({ prefix: '/stats' })

/** GET /stats/overview — 首页概览 */
statsRouter.get('/overview', async (ctx: Context) => {
  const overview = await statsService.getOverview(ctx.state.userId as number)
  ok(ctx, overview)
})

/** GET /stats/missed — 缺席列表 */
const missedQuerySchema = z.object({
  planId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

statsRouter.get('/missed', async (ctx: Context) => {
  const parsed = missedQuerySchema.safeParse(ctx.query)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const result = await statsService.getMissedList(ctx.state.userId as number, parsed.data)
  ok(ctx, result)
})

/**
 * 计划进度路由（挂在 /plans/:id/progress，单独导出给 routes/index.ts 挂载）
 */
export const planProgressRouter = new Router()

planProgressRouter.get('/plans/:id/progress', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const progress = await statsService.getPlanProgress(ctx.state.userId as number, planId)
  ok(ctx, progress)
})

/** GET /plans/:id/values — 数值趋势数据（recordValue 计划用） */
planProgressRouter.get('/plans/:id/values', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const limit = ctx.query.limit ? Number(ctx.query.limit) : 30
  const values = await statsService.getPlanValues(ctx.state.userId as number, planId, limit)
  ok(ctx, values)
})
