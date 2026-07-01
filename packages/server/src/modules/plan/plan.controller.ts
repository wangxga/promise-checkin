import Router from '@koa/router'
import type { Context } from 'koa'
import { createPlanSchema, updatePlanSchema, listPlansQuerySchema } from './plan.dto.js'
import * as planService from './plan.service.js'
import { ok } from '../../shared-utils/response.js'
import { BusinessError } from '../../shared-utils/errors.js'

/**
 * Plan Controller — HTTP 层
 * 路由挂载在 /api/v1/plans 下
 */
export const planRouter = new Router({ prefix: '/plans' })

/** GET /plans — 列表 */
planRouter.get('/', async (ctx: Context) => {
  const parsed = listPlansQuerySchema.safeParse(ctx.query)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const result = await planService.listPlans(ctx.state.userId as number, parsed.data)
  ok(ctx, result)
})

/** GET /plans/trash — 回收站（已删除计划列表，必须在 /:id 之前注册避免被 :id 捕获） */
planRouter.get('/trash', async (ctx: Context) => {
  const plans = await planService.listDeletedPlans(ctx.state.userId as number)
  ok(ctx, plans)
})

/** GET /plans/:id — 详情 */
planRouter.get('/:id', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const plan = await planService.getPlanById(ctx.state.userId as number, planId)
  ok(ctx, plan)
})

/** POST /plans — 新建 */
planRouter.post('/', async (ctx: Context) => {
  const parsed = createPlanSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const plan = await planService.createPlan(ctx.state.userId as number, parsed.data)
  ok(ctx, plan)
})

/** PUT /plans/:id — 更新 */
planRouter.put('/:id', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const parsed = updatePlanSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const plan = await planService.updatePlan(ctx.state.userId as number, planId, parsed.data)
  ok(ctx, plan)
})

/** PATCH /plans/:id/archive — 归档 */
planRouter.patch('/:id/archive', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const plan = await planService.archivePlan(ctx.state.userId as number, planId)
  ok(ctx, plan)
})

/** DELETE /plans/:id — 软删除 */
planRouter.delete('/:id', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  await planService.deletePlan(ctx.state.userId as number, planId)
  ok(ctx, null, '已删除')
})

/** PATCH /plans/:id/restore — 从回收站恢复 */
planRouter.patch('/:id/restore', async (ctx: Context) => {
  const planId = Number(ctx.params.id)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const plan = await planService.restorePlan(ctx.state.userId as number, planId)
  ok(ctx, plan)
})
