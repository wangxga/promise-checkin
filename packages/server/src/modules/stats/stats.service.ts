import { prisma } from '../../lib/prisma.js'
import { planRepository } from '../plan/plan.repository.js'
import { checkinRepository } from '../checkin/checkin.repository.js'
import { assertOwnPlan } from '../plan/plan.service.js'
import { toPlanDTO, toCheckinDTO, calcProgress } from '../../shared-utils/mapper.js'
import { shanghaiTodayRange, shanghaiTodayStr } from '../../shared-utils/timezone.js'
import { generateSlots } from '../../shared-utils/schedule.js'
import type { PlanProgress } from '@promise-checkin/shared'

/**
 * Stats Service — 统计查询层（只读，复用 plan/checkin repository）
 * 不写数据，纯聚合计算
 */

/**
 * 首页概览
 * - 今日待办/已完成
 * - 本周缺席数
 * - 最近缺席 + 今日待办列表
 */
export async function getOverview(userId: number) {
  const uid = BigInt(userId)
  const { start: today, end: todayEnd } = shanghaiTodayRange()

  // 今日所有打卡记录（pending + done）
  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: uid,
      scheduledDate: { gte: today, lt: todayEnd },
      deletedAt: null,
    },
    include: {
      plan: {
        select: { id: true, name: true, type: true, color: true, recordValue: true, valueUnit: true },
      },
    },
    orderBy: { scheduledTime: 'asc' },
  })

  const todayTodo = todayCheckins.filter((c) => c.status === 'pending')
  const todayDone = todayCheckins.filter((c) => c.status === 'done')

  // 缺席总数（MVP 简化：暂不按本周筛选）
  const weekMissed = await checkinRepository.countByUserAndStatus(uid, 'missed')

  // 计划数
  const activePlans = await prisma.plan.count({
    where: { userId: uid, status: 'active', deletedAt: null },
  })

  return {
    totalPlans: activePlans,
    todayTodo: todayTodo.length,
    todayDone: todayDone.length,
    weekMissed,
    todayTodoList: todayTodo.map((c) => ({
      checkinId: Number(c.id),
      planId: Number(c.planId),
      planName: c.plan.name,
      planColor: c.plan.color,
      recordValue: c.plan.recordValue,
      valueUnit: c.plan.valueUnit,
      scheduledDate: c.scheduledDate.toISOString().slice(0, 10),
      scheduledTime: c.scheduledTime,
    })),
    todayDoneList: todayDone.map((c) => ({
      checkinId: Number(c.id),
      planId: Number(c.planId),
      planName: c.plan.name,
      scheduledTime: c.scheduledTime,
    })),
  }
}

/**
 * 计划进度（深度统计）
 * - 多口径进度（consumed/remain/progress）
 * - 连续打卡 streak
 * - 完成率
 * - 预计完成日期
 */
export async function getPlanProgress(userId: number, planId: number): Promise<PlanProgress & {
  doneCount: number
  missedCount: number
  streak: number
  completionRate: number | null
  estimatedEndDate: string | null
}> {
  const plan = await assertOwnPlan(userId, planId)
  const planDTO = toPlanDTO(plan)
  const progress = calcProgress(planDTO)

  // streak：从最近 done 往前数连续完成（按有排期的天）
  const streak = await calcStreak(plan.id)

  // 完成率：done / (done + missed)
  const doneCount = plan.doneCount
  const missedCount = plan.missedCount
  const rated = doneCount + missedCount
  const completionRate = rated > 0 ? doneCount / rated : null

  // 预计完成日期：按当前排期节奏（每周规则数）估算
  let estimatedEndDate: string | null = null
  if (plan.totalCount !== null && planDTO.timeMode === 'fixed' && progress.remain !== null && progress.remain > 0) {
    const rules = plan.scheduleConfig as { rules?: unknown[] } | null
    const rulesCount = rules?.rules?.length ?? 1
    const weeks = Math.ceil(progress.remain / rulesCount)
    const est = new Date()
    est.setDate(est.getDate() + weeks * 7)
    estimatedEndDate = est.toISOString().slice(0, 10)
  }

  return {
    ...progress,
    doneCount,
    missedCount,
    streak,
    completionRate,
    estimatedEndDate,
  }
}

/** 计算 streak（连续打卡天数）
 * 从今天（或最近的过去槽位日）往前数连续完成的排期天
 * - 跳过未来的 pending 槽位（不影响 streak）
 * - 遇到"本该打卡（有排期）但未完成（missed 或已过期未打）"才中断
 */
async function calcStreak(planId: bigint): Promise<number> {
  const allSlots = await checkinRepository.listByPlan(planId)
  if (!allSlots.length) return 0
  const doneSet = new Set(
    allSlots.filter((c) => c.status === 'done').map((c) => c.scheduledDate.toISOString().slice(0, 10)),
  )
  // 只看 ≤ 今天的槽位日（排除未来 pending），"今天"按上海时区
  const todayStr = shanghaiTodayStr()
  const slotDays = [
    ...new Set(allSlots.map((c) => c.scheduledDate.toISOString().slice(0, 10))),
  ]
    .filter((ds) => ds <= todayStr)
    .sort()
  if (!slotDays.length) return 0

  let streak = 0
  // 从最近的过去槽位日往前数
  const d = new Date(slotDays[slotDays.length - 1] + 'T00:00:00')
  const earliest = slotDays[0]
  while (d.toISOString().slice(0, 10) >= earliest) {
    const ds = d.toISOString().slice(0, 10)
    // 这天有排期但没完成 → 中断
    if (slotDays.includes(ds) && !doneSet.has(ds)) break
    if (doneSet.has(ds)) streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/**
 * 计划的数值趋势数据（近 N 次 done 记录的 value 序列）
 * 用于详情页趋势折线图（量血压/背单词等 recordValue 计划）
 */
export async function getPlanValues(userId: number, planId: number, limit = 30) {
  const plan = await assertOwnPlan(userId, planId)
  if (!plan.recordValue) {
    return { unit: plan.valueUnit, values: [] }
  }
  // 取最近 N 条（desc），再反转为时间升序（折线图左旧右新）
  const records = await prisma.checkin.findMany({
    where: {
      planId: plan.id,
      status: 'done',
      value: { not: null },
      deletedAt: null,
    },
    orderBy: { scheduledDate: 'desc' },
    take: limit,
    select: { scheduledDate: true, value: true },
  })
  records.reverse()
  return {
    unit: plan.valueUnit,
    values: records.map((r) => ({
      date: r.scheduledDate.toISOString().slice(0, 10),
      value: Number(r.value),
    })),
  }
}

/**
 * 缺席列表（跨计划）
 */
export async function getMissedList(
  userId: number,
  opts: { planId?: number; page: number; pageSize: number },
) {
  const uid = BigInt(userId)
  const where = {
    userId: uid,
    status: 'missed',
    deletedAt: null,
    ...(opts.planId ? { planId: BigInt(opts.planId) } : {}),
  }
  const [records, total] = await Promise.all([
    prisma.checkin.findMany({
      where,
      orderBy: { scheduledDate: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { plan: { select: { id: true, name: true, color: true } } },
    }),
    prisma.checkin.count({ where }),
  ])
  return {
    list: records.map((c) => ({
      ...toCheckinDTO(c),
      planName: c.plan.name,
      planColor: c.plan.color,
    })),
    total,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}
