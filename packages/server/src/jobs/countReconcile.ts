import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { syncPlanCounts } from '../modules/plan/plan.service.js'

/**
 * 计数校对任务
 * 每日重算所有 active 计划的 doneCount/missedCount，防止冗余字段漂移
 * 只校对过去 24h 有 checkin 变更的计划（增量，不全表扫）
 */
export async function runCountReconcile(): Promise<void> {
  // 过去 24h：纯时间运算（不涉及时区日期边界）
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // 找过去 24h 有记录变更的计划
  const affectedPlanIds = await prisma.checkin.findMany({
    where: { updatedAt: { gte: since }, deletedAt: null },
    select: { planId: true },
    distinct: ['planId'],
  })

  let reconciled = 0
  for (const { planId } of affectedPlanIds) {
    await syncPlanCounts(planId)
    reconciled++
  }

  if (reconciled > 0) {
    logger.info({ reconciled }, '[job] 计数校对完成')
  }
}
