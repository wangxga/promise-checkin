/**
 * 时区 bug 数据修复脚本
 *
 * 背景：schedule.ts / mapper.ts 等曾经混用本地时区与 UTC，
 *       导致 scheduledDate 写入和读取口径不一致，日期整体偏移一天。
 *       现已修复（全部改用上海时区 shanghaiDateStr），但历史数据仍需纠正。
 *
 * 作用：
 *   1. 删除所有 status=pending 的 checkin 记录（这些是错位的排期槽位）
 *   2. 用修复后的 generateSlots 重新生成未来 14 天排期
 *   3. done/missed 的历史打卡记录不动（用户的历史成果保留）
 *
 * 用法（本地开发环境）：
 *   pnpm --filter @promise-checkin/server fix:offset
 *
 * 用法（生产 Docker 环境，容器内执行）：
 *   docker exec -it checkin-api node dist/scripts/fix-offset-checkins.js
 *
 * 注意：
 *   - 只跑一次即可，重复跑不会出错（幂等）
 *   - 如果 done/missed 的历史记录日期也偏移了（因为 toISOString slice bug），
 *     这个脚本不修它们——历史记录的日期偏移只影响日历展示，
 *     不影响计数（doneCount/missedCount 是按 status 统计的，不依赖日期）。
 *     如果日历上历史打卡点位置不对，只能手动调整或忽略（历史数据不影响新打卡）。
 */

// 加载环境变量（与 config/index.ts 相同的两层加载逻辑）
import dotenv from 'dotenv'
import path from 'node:path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const nodeEnv = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) })

import { PrismaClient } from '@prisma/client'
import { generateSlots } from '../shared-utils/schedule.js'
import { shanghaiTodayStr } from '../shared-utils/timezone.js'
import type { ScheduleConfig } from '@promise-checkin/shared'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  // 1. 统计并删除所有 pending 记录
  const pendingCount = await prisma.checkin.count({ where: { status: 'pending' } })
  console.log(`找到 ${pendingCount} 条 pending 记录`)
  if (pendingCount > 0) {
    const deleted = await prisma.checkin.deleteMany({ where: { status: 'pending' } })
    console.log(`已删除 ${deleted.count} 条 pending 记录`)
  }

  // 2. 查所有 fixed 模式的 active 计划
  const plans = await prisma.plan.findMany({
    where: { timeMode: 'fixed', status: 'active', deletedAt: null },
    select: { id: true, userId: true, name: true, startDate: true, scheduleConfig: true },
  })
  console.log(`为 ${plans.length} 个计划重新生成排期`)

  // 3. 用修复后的 generateSlots 重新生成
  const todayStr = shanghaiTodayStr()
  const startDate = new Date(`${todayStr}T00:00:00.000Z`)
  const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)

  let totalAdded = 0
  for (const plan of plans) {
    const config = plan.scheduleConfig as unknown as ScheduleConfig | null
    if (!config?.rules?.length) continue

    const slots = generateSlots(config, startDate, endDate)
    if (!slots.length) continue

    for (const slot of slots) {
      await prisma.checkin
        .create({
          data: {
            planId: plan.id,
            userId: plan.userId,
            scheduledDate: slot.scheduledDate,
            scheduledTime: slot.scheduledTime,
            status: 'pending',
            source: 'scheduled',
          },
        })
        .catch(() => {
          // 跳过重复（唯一约束冲突），相当于 skipDuplicates
        })
    }
    totalAdded += slots.length
    console.log(`  计划 ${plan.id} (${plan.name}): 生成 ${slots.length} 条`)
  }

  console.log(`\n修复完成：删除 ${pendingCount} 条，重新生成 ${totalAdded} 条`)
}

main()
  .then(() => console.log('✅ done'))
  .catch((e) => {
    console.error('❌ 修复失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
