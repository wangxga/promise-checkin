import { z } from 'zod'
import { BUSINESS_DEFAULTS } from '@promise-checkin/shared'

/**
 * Plan 模块 zod schema
 * z.infer 推导出请求体类型，不重复手写
 */

/** 排期规则（按周几 或 每天） */
const weekdayRule = z.object({
  weekday: z.number().int().min(1).max(7),
  time: z.string().regex(/^\d{2}:\d{2}$/, '时间格式应为 HH:mm'),
})

const everydayRule = z.object({
  every: z.literal('day'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '时间格式应为 HH:mm'),
})

const scheduleConfig = z.object({
  rules: z.array(z.union([weekdayRule, everydayRule])).min(1, '至少需要一条排期规则'),
})

/** POST /plans 新建 */
export const createPlanSchema = z.object({
  name: z.string().min(1, '计划名称不能为空').max(BUSINESS_DEFAULTS.PLAN_NAME_MAX_LENGTH),
  type: z.enum(['course', 'medicine', 'measure', 'fitness', 'learning', 'custom']),
  color: z.string().default('#007AFF'),
  totalCount: z.number().int().positive().nullable().optional(),
  initialDoneCount: z.number().int().min(0).default(0),
  absenceConsumes: z.boolean().default(false),
  timeMode: z.enum(['fixed', 'flexible']),
  scheduleConfig: scheduleConfig.nullable().optional(),
  overdueHandling: z.enum(['keep_pending', 'auto_missed']).default('keep_pending'),
  overdueGraceHours: z.number().int().positive().default(24),
  recordValue: z.boolean().default(false),
  valueUnit: z.string().max(16).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remark: z.string().max(BUSINESS_DEFAULTS.REMARK_MAX_LENGTH).nullable().optional(),
})
export type CreatePlanDTO = z.infer<typeof createPlanSchema>

/** PUT /plans/:id 更新（type 不可改，service 层拦截） */
export const updatePlanSchema = createPlanSchema.partial().omit({ type: true })
export type UpdatePlanDTO = z.infer<typeof updatePlanSchema>

/** 列表查询参数 */
export const listPlansQuerySchema = z.object({
  type: z.string().optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>
