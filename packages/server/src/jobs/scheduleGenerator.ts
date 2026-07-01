import { prisma } from '../lib/prisma.js'
import { generateSlots } from '../shared-utils/schedule.js'
import { logger } from '../lib/logger.js'
import type { ScheduleConfig } from '@promise-checkin/shared'

/**
 * 排期生成任务
 * 每日为 fixed 模式的 active 计划补充未来 14 天的 pending 槽位
 * 直接操作 DB（复用 generateSlots 逻辑），不走 HTTP
 */
export async function runScheduleGenerator(): Promise<void> {
  const plans = await prisma.plan.findMany({
    where: { timeMode: 'fixed', status: 'active', deletedAt: null },
  })

  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 14)

  let totalAdded = 0

  for (const plan of plans) {
    const config = plan.scheduleConfig as unknown as ScheduleConfig | null
    if (!config?.rules?.length) continue

    const slots = generateSlots(config, startDate, endDate)
    const existing = new Set(
      (
        await prisma.checkin.findMany({
          where: { planId: plan.id, scheduledDate: { gte: startDate, lte: endDate } },
          select: { scheduledDate: true, scheduledTime: true },
        })
      ).map((c) => c.scheduledDate.toISOString().slice(0, 10) + '|' + (c.scheduledTime ?? '')),
    )

    for (const slot of slots) {
      const key = slot.scheduledDate.toISOString().slice(0, 10) + '|' + (slot.scheduledTime ?? '')
      if (!existing.has(key)) {
        await prisma.checkin.create({
          data: {
            planId: plan.id,
            userId: plan.userId,
            scheduledDate: slot.scheduledDate,
            scheduledTime: slot.scheduledTime,
            status: 'pending',
            source: 'scheduled',
          },
        })
        totalAdded++
      }
    }
  }

  if (totalAdded > 0) {
    logger.info({ plans: plans.length, added: totalAdded }, '[job] 排期生成完成')
  }
}
