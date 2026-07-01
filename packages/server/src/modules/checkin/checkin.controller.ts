import Router from '@koa/router'
import type { Context } from 'koa'
import {
  upsertCheckinSchema,
  updateCheckinSchema,
  rescheduleSchema,
  retroactiveSchema,
  calendarQuerySchema,
} from './checkin.dto.js'
import * as checkinService from './checkin.service.js'
import { ok } from '../../shared-utils/response.js'
import { BusinessError } from '../../shared-utils/errors.js'

/**
 * Checkin Controller — HTTP 层
 * 注意：部分路由挂在 /plans/:planId/checkins 下，部分挂在 /checkins/:id 下
 * 这里拆成两个 router，由 routes/index.ts 分别挂载
 */

/** 按计划维度的打卡路由（前缀由 routes/index.ts 拼接） */
export const planCheckinRouter = new Router()

/** GET /plans/:planId/checkins — 列表 */
planCheckinRouter.get('/plans/:planId/checkins', async (ctx: Context) => {
  const planId = Number(ctx.params.planId)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const result = await checkinService.listCheckins(ctx.state.userId as number, planId, {
    startDate: ctx.query.startDate as string | undefined,
    endDate: ctx.query.endDate as string | undefined,
    status: ctx.query.status as string | undefined,
  })
  ok(ctx, result)
})

/** GET /plans/:planId/checkins/calendar — 日历 */
planCheckinRouter.get('/plans/:planId/checkins/calendar', async (ctx: Context) => {
  const planId = Number(ctx.params.planId)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const parsed = calendarQuerySchema.safeParse(ctx.query)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const result = await checkinService.getCalendar(ctx.state.userId as number, planId, parsed.data.month)
  ok(ctx, result)
})

/** POST /plans/:planId/checkins — upsert 打卡 */
planCheckinRouter.post('/plans/:planId/checkins', async (ctx: Context) => {
  const planId = Number(ctx.params.planId)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const parsed = upsertCheckinSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const checkin = await checkinService.upsertCheckin(ctx.state.userId as number, planId, parsed.data)
  ok(ctx, checkin)
})

/** POST /plans/:planId/checkins/retroactive — 补录 */
planCheckinRouter.post('/plans/:planId/checkins/retroactive', async (ctx: Context) => {
  const planId = Number(ctx.params.planId)
  if (!Number.isFinite(planId)) throw BusinessError.notFound('计划不存在')
  const parsed = retroactiveSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const checkin = await checkinService.retroactiveDone(ctx.state.userId as number, planId, parsed.data)
  ok(ctx, checkin)
})

/** 单条打卡记录路由 */
export const checkinRouter = new Router({ prefix: '/checkins' })

/** GET /checkins/:id — 详情 */
checkinRouter.get('/:id', async (ctx: Context) => {
  const id = Number(ctx.params.id)
  if (!Number.isFinite(id)) throw BusinessError.notFound('打卡记录不存在')
  const checkin = await checkinService.getCheckin(ctx.state.userId as number, id)
  ok(ctx, checkin)
})

/** PATCH /checkins/:id — 改状态 */
checkinRouter.patch('/:id', async (ctx: Context) => {
  const id = Number(ctx.params.id)
  if (!Number.isFinite(id)) throw BusinessError.notFound('打卡记录不存在')
  const parsed = updateCheckinSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const checkin = await checkinService.updateCheckin(ctx.state.userId as number, id, parsed.data)
  ok(ctx, checkin)
})

/** POST /checkins/:id/reschedule — 调整排期 */
checkinRouter.post('/:id/reschedule', async (ctx: Context) => {
  const id = Number(ctx.params.id)
  if (!Number.isFinite(id)) throw BusinessError.notFound('打卡记录不存在')
  const parsed = rescheduleSchema.safeParse(ctx.request.body)
  if (!parsed.success) {
    throw BusinessError.validation(
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    )
  }
  const checkin = await checkinService.adjustSchedule(ctx.state.userId as number, id, parsed.data)
  ok(ctx, checkin)
})

/** DELETE /checkins/:id — 删除 */
checkinRouter.delete('/:id', async (ctx: Context) => {
  const id = Number(ctx.params.id)
  if (!Number.isFinite(id)) throw BusinessError.notFound('打卡记录不存在')
  await checkinService.deleteCheckin(ctx.state.userId as number, id)
  ok(ctx, null, '已删除')
})
