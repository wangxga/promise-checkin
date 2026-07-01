import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { syncPlanCounts } from '../modules/plan/plan.service.js'
import { now, shanghaiDeadline } from '../shared-utils/timezone.js'

/**
 * 逾期扫描任务
 * 扫描 status=pending 且超过宽限期的记录
 * 按 plan.overdueHandling：auto_missed 则转 missed，keep_pending 不动
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
    const records = await prisma.checkin.findMany({
      where: {
        planId: plan.id,
        status: 'pending',
        deletedAt: null,
      },
    })

    for (const record of records) {
      // 截止时间 = 上海时区的 scheduledDate + scheduledTime + graceHours
      const dateStr = record.scheduledDate.toISOString().slice(0, 10)
      const deadline = shanghaiDeadline(dateStr, record.scheduledTime, plan.overdueGraceHours)

      if (now() > deadline) {
        await prisma.checkin.update({
          where: { id: record.id },
          data: {
            status: 'missed',
            remark: record.remark ?? '逾期未打卡（自动标记）',
          },
        })
        totalConverted++
        affectedPlans.add(plan.id)
      }
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
