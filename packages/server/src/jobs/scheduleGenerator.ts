import { prisma } from '../lib/prisma'
import { ensurePlanSchedule, syncPlanCounts } from '../modules/plan/plan.service.js'
import { logger } from '../lib/logger.js'

/**
 * 排期生成任务
 * 每日为 fixed 模式的 active 计划补齐排期（ensurePlanSchedule 统一口径）：
 * - 无次数上限的计划：滚动补充未来 14 天
 * - 固定次数计划：排满 totalCount 为止（缺勤不消耗配额的会自动补位）
 * - startDate 在过去且存在缺口的（旧数据 / 补建计划）：历史区间一并回填
 */
export async function runScheduleGenerator(): Promise<void> {
  const plans = await prisma.plan.findMany({
    where: { timeMode: 'fixed', status: 'active', deletedAt: null },
  })

  let totalAdded = 0
  const needSync: bigint[] = []

  for (const plan of plans) {
    const added = await ensurePlanSchedule(prisma, {
      id: plan.id,
      userId: plan.userId,
      startDate: plan.startDate,
      totalCount: plan.totalCount,
      initialDoneCount: plan.initialDoneCount,
      absenceConsumes: plan.absenceConsumes,
      timeMode: plan.timeMode,
      scheduleConfig: plan.scheduleConfig,
      overdueHandling: plan.overdueHandling,
      overdueGraceHours: plan.overdueGraceHours,
    })
    totalAdded += added.pending + added.missed
    if (added.missed > 0) needSync.push(plan.id)
  }

  for (const planId of needSync) {
    await syncPlanCounts(planId)
  }

  if (totalAdded > 0) {
    logger.info({ plans: plans.length, added: totalAdded }, '[job] 排期生成完成')
  }
}
