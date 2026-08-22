import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { markPlanOverdueMissed, syncPlanCounts } from '../modules/plan/plan.service.js'

/**
 * 逾期扫描任务
 * 每小时扫描 auto_missed 计划下超过宽限期的 pending 记录并转 missed。
 * keep_pending 计划不动（保持待补录，语义见计划编辑页「逾期处理」）。
 * 转换口径与 ensurePlanSchedule 共用 markPlanOverdueMissed，保证一致。
 */
export async function runOverdueScanner(): Promise<void> {
  // 查所有 auto_missed 计划下的 pending 记录
  const autoMissedPlans = await prisma.plan.findMany({
    where: { overdueHandling: 'auto_missed', status: 'active', deletedAt: null },
    select: { id: true, overdueGraceHours: true },
  })

  if (!autoMissedPlans.length) return

  let totalConverted = 0
  const affectedPlans = new Set<bigint>()

  for (const plan of autoMissedPlans) {
    const converted = await markPlanOverdueMissed(prisma, plan)
    if (converted > 0) {
      totalConverted += converted
      affectedPlans.add(plan.id)
    }
  }

  // 重算受影响计划的计数
  for (const planId of affectedPlans) {
    await syncPlanCounts(planId)
  }

  if (totalConverted > 0) {
    logger.info({ converted: totalConverted, plans: affectedPlans.size }, '[job] 逾期扫描完成')
  }
}
