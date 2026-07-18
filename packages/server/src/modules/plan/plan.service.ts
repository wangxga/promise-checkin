import { planRepository } from './plan.repository.js'
import { checkinRepository } from '../checkin/checkin.repository.js'
import { toPlanDTO, calcProgress } from '../../shared-utils/mapper.js'
import { generateSlots } from '../../shared-utils/schedule.js'
import { BusinessError } from '../../shared-utils/errors.js'
import { logger } from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import type { Plan } from '@promise-checkin/shared'
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

  // 事务：建计划 + 首次生成排期槽位
  const plan = await prisma.$transaction(async (tx) => {
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

    // 首次生成未来 14 天排期（fixed 模式），新建计划无已存在记录，直接 create
    if (dto.timeMode === 'fixed' && dto.scheduleConfig) {
      const endDate = new Date(startDate.getTime() + 14 * 24 * 3600 * 1000)
      const slots = generateSlots(dto.scheduleConfig, startDate, endDate)
      for (const slot of slots) {
        await tx.checkin.create({
          data: {
            planId: created.id,
            userId: BigInt(userId),
            scheduledDate: slot.scheduledDate,
            scheduledTime: slot.scheduledTime,
            status: 'pending',
            source: 'scheduled',
          },
        })
      }
      logger.info({ planId: created.id, slots: slots.length }, '[plan] 首次生成排期')
    }

    return created
  })

  return toPlanDTO(plan)
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
