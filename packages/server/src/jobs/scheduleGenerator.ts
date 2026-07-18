import { prisma } from '../lib/prisma.js'
import { generateSlots } from '../shared-utils/schedule.js'
import { shanghaiTodayRange } from '../shared-utils/timezone.js'
import { logger } from '../lib/logger.js'
import type { ScheduleConfig } from '@promise-checkin/shared'

/**
 * 排期生成任务
 * 每日为 fixed 模式的 active 计划补充未来 14 天的 pending 槽位
 * 用 createMany + skipDuplicates 让 DB 层面跳过重复（避免应用层去重的时区陷阱）
 */
export async function runScheduleGenerator(): Promise<void> {
  const plans = await prisma.plan.findMany({
    where: { timeMode: 'fixed', status: 'active', deletedAt: null },
  })

  const { start: startDate } = shanghaiTodayRange()
  const endDate = new Date(startDate.getTime() + 14 * 24 * 3600 * 1000)

  let totalAdded = 0

  for (const plan of plans) {
    const config = plan.scheduleConfig as unknown as ScheduleConfig | null
    if (!config?.rules?.length) continue

    const slots = generateSlots(config, startDate, endDate)
    if (!slots.length) continue

    // createMany + skipDuplicates：DB 自动跳过唯一约束冲突的记录
    const result = await prisma.checkin.createMany({
      data: slots.map((slot) => ({
        planId: plan.id,
        userId: plan.userId,
        scheduledDate: slot.scheduledDate,
        scheduledTime: slot.scheduledTime,
        status: 'pending' as const,
        source: 'scheduled' as const,
      })),
      skipDuplicates: true,
    })
    totalAdded += result.count
  }

  if (totalAdded > 0) {
    logger.info({ plans: plans.length, added: totalAdded }, '[job] 排期生成完成')
  }
}
