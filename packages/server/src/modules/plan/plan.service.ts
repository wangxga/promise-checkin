import { planRepository } from './plan.repository.js'
import { checkinRepository } from '../checkin/checkin.repository.js'
import { toPlanDTO, calcProgress } from '../../shared-utils/mapper.js'
import { generateSlots } from '../../shared-utils/schedule.js'
import { now, shanghaiDateStr, shanghaiDeadline, shanghaiTodayRange } from '../../shared-utils/timezone.js'
import { BusinessError } from '../../shared-utils/errors.js'
import { logger } from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import type { Plan } from '@promise-checkin/shared'
import type { ScheduleConfig } from '@promise-checkin/shared'
import type { CreatePlanDTO, UpdatePlanDTO, ListPlansQuery } from './plan.dto.js'

/**
 * Plan Service — 业务逻辑层
 * 职责：计划 CRUD 编排、首次排期生成、计数派生、权限校验
 * 不接触 HTTP，可被 Controller 和定时任务复用
 */

/** 权限校验：确保计划属于该用户，否则抛 notFound（不暴露存在性） */
export async function assertOwnPlan(userId: number, planId: number): Promise<NonNullable<Awaited<ReturnType<typeof planRepository.findById>>>> {
  const plan = await planRepository.findById(BigInt(planId))
  if (!plan || plan.userId !== BigInt(userId)) {
    throw BusinessError.notFound('计划不存在')
  }
  return plan
}

/** 同步计划的 doneCount/missedCount（写打卡记录后调用，防冗余字段漂移） */
export async function syncPlanCounts(planId: bigint): Promise<void> {
  const [doneCount, missedCount] = await Promise.all([
    checkinRepository.countByPlanAndStatus(planId, 'done'),
    checkinRepository.countByPlanAndStatus(planId, 'missed'),
  ])
  await planRepository.update(planId, { doneCount, missedCount })
}

/** ensurePlanSchedule / markPlanOverdueMissed 需要的计划字段 */
export interface SchedulablePlan {
  id: bigint
  userId: bigint
  startDate: Date | null
  totalCount: number | null
  initialDoneCount: number
  absenceConsumes: boolean
  timeMode: string
  scheduleConfig: unknown
  overdueHandling: string
  overdueGraceHours: number
}

/**
 * 把某计划下已过截止时间的 pending 记录转 missed（仅 auto_missed 计划有意义，
 * 调用方负责判断 overdueHandling）。逾期扫描任务与排期补齐共用，保证口径一致。
 * @returns 转换条数
 */
export async function markPlanOverdueMissed(
  db: Prisma.TransactionClient,
  plan: { id: bigint; overdueGraceHours: number },
): Promise<number> {
  const records = await db.checkin.findMany({
    where: { planId: plan.id, status: 'pending', deletedAt: null },
    select: { id: true, scheduledDate: true, scheduledTime: true, remark: true },
  })
  const nowMs = now().getTime()
  let converted = 0
  for (const record of records) {
    // 截止时间 = 上海时区 scheduledDate + scheduledTime + 宽限期
    const deadline = shanghaiDeadline(
      shanghaiDateStr(record.scheduledDate),
      record.scheduledTime,
      plan.overdueGraceHours,
    )
    if (deadline.getTime() <= nowMs) {
      await db.checkin.update({
        where: { id: record.id },
        data: { status: 'missed', remark: record.remark ?? '逾期未打卡（自动标记）' },
      })
      converted++
    }
  }
  return converted
}

/**
 * 排期补齐（建计划 / 更新计划 / 每日续期三处共用）
 *
 * 语义：
 * - 窗口 [startDate, max(今天, startDate)+14天]：startDate 在过去时，
 *   [startDate+14天, 今天] 的历史缺口会一并回填（自愈旧数据）
 * - 固定次数计划受 totalCount 约束：排满为止（窗口按规则频率自动延长），
 *   新增后 consumed + pending ≤ totalCount。consumed 口径与 calcProgress 一致
 *   （初始进度 + done + 缺勤消耗时 missed）；缺勤不消耗配额的计划，
 *   pending 转 missed 后下次续期自动补位，直到 done 打满
 * - 槽位截止时间已过且 overdueHandling=auto_missed：直接生成 missed，
 *   并顺带把已存在的过期 pending 转 missed；keep_pending 则一律 pending（待补录）
 * - 先剔除已存在槽位再截断配额，createMany + skipDuplicates 幂等
 *
 * @returns 新增 pending / 转+新增 missed 的条数（missed>0 时调用方需在事务提交后 syncPlanCounts）
 */
export async function ensurePlanSchedule(
  db: Prisma.TransactionClient,
  plan: SchedulablePlan,
): Promise<{ pending: number; missed: number }> {
  if (plan.timeMode !== 'fixed') return { pending: 0, missed: 0 }
  const config = plan.scheduleConfig as ScheduleConfig | null
  if (!config?.rules?.length) return { pending: 0, missed: 0 }

  // 已占用的槽位（done/missed/pending 都算，防重复生成挤占配额）
  const existing = await db.checkin.findMany({
    where: { planId: plan.id, deletedAt: null },
    select: { scheduledDate: true, scheduledTime: true },
  })
  const existingKeys = new Set(existing.map((e) => `${e.scheduledDate.getTime()}:${e.scheduledTime}`))

  // 固定次数：按进度口径算剩余可排额度
  let cap = Number.POSITIVE_INFINITY
  if (plan.totalCount !== null) {
    const [done, missedCnt, pendingCnt] = await Promise.all([
      db.checkin.count({ where: { planId: plan.id, status: 'done', deletedAt: null } }),
      db.checkin.count({ where: { planId: plan.id, status: 'missed', deletedAt: null } }),
      db.checkin.count({ where: { planId: plan.id, status: 'pending', deletedAt: null } }),
    ])
    const consumed = plan.initialDoneCount + done + (plan.absenceConsumes ? missedCnt : 0)
    cap = plan.totalCount - consumed - pendingCnt
    if (cap <= 0) return { pending: 0, missed: 0 }
  }

  // 窗口：从计划开始日（含历史回填；为空视为今天）到「今天与开始日中较晚者」+14 天；
  // 固定次数计划按规则频率（每条规则每周约 1 次）延长到足够排满，封顶 5 年防呆
  const { start: todayStart } = shanghaiTodayRange()
  const windowStart = plan.startDate ?? todayStart
  const anchor = windowStart > todayStart ? windowStart : todayStart
  let windowEnd = new Date(anchor.getTime() + 14 * 24 * 3600 * 1000)
  if (Number.isFinite(cap)) {
    const perWeek = config.rules.length
    const daysNeeded = Math.ceil(cap / perWeek) * 7 + 14
    const capEnd = new Date(windowStart.getTime() + daysNeeded * 24 * 3600 * 1000)
    if (capEnd > windowEnd) windowEnd = capEnd
  }

  // 只保留尚不存在的槽位，再按配额截断
  let slots = generateSlots(config, windowStart, windowEnd).filter(
    (s) => !existingKeys.has(`${s.scheduledDate.getTime()}:${s.scheduledTime}`),
  )
  if (slots.length > cap) slots = slots.slice(0, cap)
  if (!slots.length) {
    // 没有新槽位，仍可能需要把存量过期 pending 转 missed
    const converted = plan.overdueHandling === 'auto_missed'
      ? await markPlanOverdueMissed(db, { id: plan.id, overdueGraceHours: plan.overdueGraceHours })
      : 0
    return { pending: 0, missed: converted }
  }

  // 新槽位按截止时间分流
  const nowMs = now().getTime()
  const pendingSlots: typeof slots = []
  const missedSlots: typeof slots = []
  for (const slot of slots) {
    const deadline = shanghaiDeadline(
      shanghaiDateStr(slot.scheduledDate),
      slot.scheduledTime,
      plan.overdueGraceHours,
    )
    const overdue = deadline.getTime() <= nowMs
    if (overdue && plan.overdueHandling === 'auto_missed') missedSlots.push(slot)
    else pendingSlots.push(slot)
  }

  const [createdPending, createdMissed] = await Promise.all([
    pendingSlots.length
      ? db.checkin.createMany({
          data: pendingSlots.map((s) => ({
            planId: plan.id,
            userId: plan.userId,
            scheduledDate: s.scheduledDate,
            scheduledTime: s.scheduledTime,
            status: 'pending' as const,
            source: 'scheduled' as const,
          })),
          skipDuplicates: true,
        })
      : Promise.resolve({ count: 0 }),
    missedSlots.length
      ? db.checkin.createMany({
          data: missedSlots.map((s) => ({
            planId: plan.id,
            userId: plan.userId,
            scheduledDate: s.scheduledDate,
            scheduledTime: s.scheduledTime,
            status: 'missed' as const,
            source: 'scheduled' as const,
            remark: '逾期未打卡（自动标记）',
          })),
          skipDuplicates: true,
        })
      : Promise.resolve({ count: 0 }),
  ])

  // 顺带把已存在的过期 pending 转 missed（如 overdueHandling 从 keep_pending 改为 auto_missed）
  let converted = 0
  if (plan.overdueHandling === 'auto_missed') {
    converted = await markPlanOverdueMissed(db, { id: plan.id, overdueGraceHours: plan.overdueGraceHours })
  }

  return { pending: createdPending.count, missed: createdMissed.count + converted }
}

/** 列表 */
export async function listPlans(userId: number, query: ListPlansQuery) {
  const [plans, total] = await Promise.all([
    planRepository.findActiveByUser(BigInt(userId), query),
    planRepository.countByUser(BigInt(userId), query),
  ])
  return {
    list: plans.map(toPlanDTO),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** 详情（含进度） */
export async function getPlanById(userId: number, planId: number): Promise<Plan> {
  const plan = await assertOwnPlan(userId, planId)
  return toPlanDTO(plan)
}

/** 创建（含首次排期生成） */
export async function createPlan(userId: number, dto: CreatePlanDTO): Promise<Plan> {
  // 校验：fixed 模式必须有 scheduleConfig
  if (dto.timeMode === 'fixed' && (!dto.scheduleConfig || dto.scheduleConfig.rules.length === 0)) {
    throw BusinessError.validation({ scheduleConfig: '固定排期模式必须配置排期规则' })
  }
  // 校验：起始进度不能超过总次数
  if (dto.totalCount !== null && dto.totalCount !== undefined && dto.initialDoneCount > dto.totalCount) {
    throw BusinessError.validation({ initialDoneCount: '起始进度不能超过总次数' })
  }

  const startDate = dto.startDate ? new Date(dto.startDate) : new Date()

  // 事务：建计划 + 首次排期补齐
  const { created, firstSchedule } = await prisma.$transaction(async (tx) => {
    const created = await tx.plan.create({
      data: {
        userId: BigInt(userId),
        name: dto.name,
        type: dto.type,
        color: dto.color,
        totalCount: dto.totalCount ?? null,
        initialDoneCount: dto.initialDoneCount,
        absenceConsumes: dto.absenceConsumes,
        timeMode: dto.timeMode,
        scheduleConfig: dto.scheduleConfig ?? Prisma.JsonNull,
        overdueHandling: dto.overdueHandling,
        overdueGraceHours: dto.overdueGraceHours,
        recordValue: dto.recordValue,
        valueUnit: dto.recordValue ? (dto.valueUnit ?? null) : null,
        startDate,
        remark: dto.remark ?? null,
      },
    })

    // 首次排期：固定次数计划直接排满 totalCount；窗口内已过截止时间的
    // 槽位按 overdueHandling 分流（auto_missed 直接 missed）
    const firstSchedule = await ensurePlanSchedule(tx, {
      id: created.id,
      userId: created.userId,
      startDate,
      totalCount: created.totalCount,
      initialDoneCount: created.initialDoneCount,
      absenceConsumes: created.absenceConsumes,
      timeMode: created.timeMode,
      scheduleConfig: dto.scheduleConfig ?? null,
      overdueHandling: created.overdueHandling,
      overdueGraceHours: created.overdueGraceHours,
    })
    logger.info(
      { planId: created.id, pending: firstSchedule.pending, missed: firstSchedule.missed },
      '[plan] 首次生成排期',
    )

    return { created, firstSchedule }
  })

  // 事务提交后再同步计数（missed 直接生成时需要刷新冗余字段）
  if (firstSchedule.missed > 0) await syncPlanCounts(created.id)

  return toPlanDTO(created)
}

/** 更新（type 不可改） */
export async function updatePlan(userId: number, planId: number, dto: UpdatePlanDTO): Promise<Plan> {
  const plan = await assertOwnPlan(userId, planId)

  const data: Record<string, unknown> = { ...dto }
  // startDate 字符串转 Date
  if (typeof dto.startDate === 'string') data.startDate = new Date(dto.startDate)
  // scheduleConfig：null 需转 Prisma.JsonNull（与 createPlan 一致）
  if (dto.scheduleConfig !== undefined) {
    data.scheduleConfig = dto.scheduleConfig === null ? Prisma.JsonNull : dto.scheduleConfig
  }
  // recordValue 关闭时清空 unit
  if (dto.recordValue === false) data.valueUnit = null

  const updated = await planRepository.update(plan.id, data)

  // 排期自愈：改了规则/次数/日期/逾期处理后补齐缺失槽位（只增不删，不动已有记录）。
  // 逾期处理改为 auto_missed 时，存量过期 pending 也会在此立即转 missed
  const added = await ensurePlanSchedule(prisma, {
    id: updated.id,
    userId: updated.userId,
    startDate: updated.startDate,
    totalCount: updated.totalCount,
    initialDoneCount: updated.initialDoneCount,
    absenceConsumes: updated.absenceConsumes,
    timeMode: updated.timeMode,
    scheduleConfig: updated.scheduleConfig,
    overdueHandling: updated.overdueHandling,
    overdueGraceHours: updated.overdueGraceHours,
  })
  if (added.missed > 0) await syncPlanCounts(updated.id)

  return toPlanDTO(updated)
}

/** 归档 */
export async function archivePlan(userId: number, planId: number): Promise<Plan> {
  const plan = await assertOwnPlan(userId, planId)
  const updated = await planRepository.updateStatus(plan.id, 'archived')
  return toPlanDTO(updated)
}

/** 删除（软删除，关联 checkins 一并软删） */
export async function deletePlan(userId: number, planId: number): Promise<void> {
  const plan = await assertOwnPlan(userId, planId)
  await prisma.$transaction([
    prisma.checkin.updateMany({
      where: { planId: plan.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.plan.update({ where: { id: plan.id }, data: { deletedAt: new Date() } }),
  ])
}

/** 计算进度（供 stats 模块复用） */
export function getProgress(plan: Plan) {
  return calcProgress(plan)
}

/** 回收站：已删除计划列表 */
export async function listDeletedPlans(userId: number) {
  const plans = await planRepository.findDeletedByUser(BigInt(userId))
  return plans.map(toPlanDTO)
}

/** 回收站：恢复计划（清除 deletedAt，恢复关联 checkins） */
export async function restorePlan(userId: number, planId: number): Promise<Plan> {
  const plan = await planRepository.findByIdIncludingDeleted(BigInt(planId))
  if (!plan || plan.userId !== BigInt(userId)) {
    throw BusinessError.notFound('计划不存在')
  }
  if (plan.deletedAt === null) {
    throw BusinessError.conflict('该计划未被删除')
  }
  // 事务：恢复计划 + 只恢复"因计划删除而被连带软删的"checkins
  // 判断依据：checkin.deletedAt 在 plan.deletedAt 前后 1 秒内（删计划事务的连带删除）
  const planDeletedAt = plan.deletedAt!
  const windowStart = new Date(planDeletedAt.getTime() - 1000)
  const windowEnd = new Date(planDeletedAt.getTime() + 1000)
  await prisma.$transaction([
    prisma.checkin.updateMany({
      where: {
        planId: plan.id,
        deletedAt: { gte: windowStart, lte: windowEnd },
      },
      data: { deletedAt: null },
    }),
    planRepository.restore(plan.id),
  ])
  const restored = await planRepository.findById(plan.id)
  return toPlanDTO(restored!)
}
