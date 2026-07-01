import { z } from 'zod'
import { BUSINESS_DEFAULTS } from '@promise-checkin/shared'

/**
 * Checkin 模块 zod schema
 */

/** POST /plans/:planId/checkins — upsert 打卡 */
export const upsertCheckinSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  status: z.enum(['done', 'missed', 'pending']),
  value: z.number().nullable().optional(),
  remark: z.string().max(BUSINESS_DEFAULTS.REMARK_MAX_LENGTH).nullable().optional(),
})
export type UpsertCheckinDTO = z.infer<typeof upsertCheckinSchema>

/** PATCH /checkins/:id — 改状态 */
export const updateCheckinSchema = z.object({
  status: z.enum(['done', 'missed', 'pending']).optional(),
  value: z.number().nullable().optional(),
  remark: z.string().max(BUSINESS_DEFAULTS.REMARK_MAX_LENGTH).nullable().optional(),
})
export type UpdateCheckinDTO = z.infer<typeof updateCheckinSchema>

/** POST /checkins/:id/reschedule — 调整排期 */
export const rescheduleSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
})
export type RescheduleDTO = z.infer<typeof rescheduleSchema>

/** POST /plans/:planId/checkins/retroactive — 补录 */
export const retroactiveSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  value: z.number().nullable().optional(),
  remark: z.string().max(BUSINESS_DEFAULTS.REMARK_MAX_LENGTH).nullable().optional(),
})
export type RetroactiveDTO = z.infer<typeof retroactiveSchema>

/** 日历查询 */
export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '月份格式应为 YYYY-MM').optional(),
})
