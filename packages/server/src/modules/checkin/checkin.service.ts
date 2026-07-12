import { checkinRepository } from './checkin.repository.js'
import { planRepository } from '../plan/plan.repository.js'
import { assertOwnPlan } from '../plan/plan.service.js'
import { syncPlanCounts } from '../plan/plan.service.js'
import { toCheckinDTO } from '../../shared-utils/mapper.js'
import { BusinessError } from '../../shared-utils/errors.js'
import { prisma } from '../../lib/prisma.js'
import type { Checkin } from '@promise-checkin/shared'
import type { UpsertCheckinDTO, UpdateCheckinDTO, RescheduleDTO, RetroactiveDTO } from './checkin.dto.js'

/**
 * Checkin Service — 打卡业务逻辑层
 * 职责：upsert 打卡、状态流转、调整排期、补录、计数事务一致性
 * 所有写操作走事务，确保 checkin 状态与 plan 的 doneCount/missedCount 原子更新
 */

/** 权限校验：确保打卡记录属于该用户 */
async function assertOwnCheckin(userId: number, checkinId: number) {
  const checkin = await checkinRepository.findById(BigInt(checkinId))
  if (!checkin || checkin.userId !== BigInt(userId)) {
    throw BusinessError.notFound('打卡记录不存在')
  }
  return checkin
}

/**
 * upsert 打卡（按 planId + date + time）
 * - 若该槽位已有记录则更新状态，无则创建
 * - 状态变化时事务更新 plan 的 doneCount/missedCount
 */
export async function upsertCheckin(userId: number, planId: number, dto: UpsertCheckinDTO): Promise<Checkin> {
  const plan = await assertOwnPlan(userId, planId)

  const scheduledDate = new Date(dto.scheduledDate)
  const scheduledTime = dto.scheduledTime ?? null

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.checkin.findFirst({
      where: { planId: plan.id, scheduledDate, scheduledTime, deletedAt: null },
    })

    if (existing) {
      const oldStatus = existing.status
      const updated = await tx.checkin.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          actualTime: dto.status === 'done' ? new Date() : null,
          value: dto.value ?? null,
          remark: dto.remark ?? null,
        },
      })
      return { checkin: updated, planId: plan.id, statusChanged: oldStatus !== dto.status }
    }

    try {
      const created = await tx.checkin.create({
        data: {
          planId: plan.id,
          userId: BigInt(userId),
          scheduledDate,
          scheduledTime,
          status: dto.status,
          actualTime: dto.status === 'done' ? new Date() : null,
          value: dto.value ?? null,
          remark: dto.remark ?? null,
          source: 'scheduled',
        },
      })
      return { checkin: created, planId: plan.id, statusChanged: true }
    } catch (err: unknown) {
      // P2002 = 唯一约束冲突（并发时另一个请求已创建了该槽位），转成业务冲突
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        throw BusinessError.conflict('该时段已有打卡记录')
      }
      throw err
    }
  })

  // 状态变了才重算计数（避免无谓的 count 查询）
  if (result.statusChanged) {
    await syncPlanCounts(plan.id)
  }
  return toCheckinDTO(result.checkin)
}

/** 改状态（快速切换 done/missed/pending） */
export async function updateCheckin(userId: number, checkinId: number, dto: UpdateCheckinDTO): Promise<Checkin> {
  const checkin = await assertOwnCheckin(userId, checkinId)
  const oldStatus = checkin.status

  // actualTime 只在状态真正切换时才动，避免 PATCH 备注/数值时误抹打卡时间
  const statusChanged = dto.status && dto.status !== oldStatus
  const updateData: Record<string, unknown> = {}
  if (dto.status) updateData.status = dto.status
  if (statusChanged) {
    updateData.actualTime = dto.status === 'done' ? new Date() : null
  }
  if (dto.value !== undefined) updateData.value = dto.value
  if (dto.remark !== undefined) updateData.remark = dto.remark

  const updated = await checkinRepository.update(checkin.id, updateData)

  if (statusChanged) {
    await syncPlanCounts(checkin.planId)
  }
  return toCheckinDTO(updated)
}

/**
 * 调整排期：改单次打卡的日期/时间，保留原排期用于追溯
 * - 首次调整时冻结 originalScheduledDate/Time
 * - 标记 adjustmentType=reschedule
 */
export async function adjustSchedule(userId: number, checkinId: number, dto: RescheduleDTO): Promise<Checkin> {
  const checkin = await assertOwnCheckin(userId, checkinId)
  const newDate = new Date(dto.newDate)
  const newTime = dto.newTime ?? null

  // 唯一约束冲突检查：目标槽位是否已有记录
  const conflict = await checkinRepository.findByPlanAndSlot(checkin.planId, newDate, newTime)
  if (conflict && conflict.id !== checkin.id) {
    throw BusinessError.conflict('目标时间已有打卡记录')
  }

  try {
    const updated = await checkinRepository.update(checkin.id, {
      scheduledDate: newDate,
      scheduledTime: newTime,
      adjustmentType: 'reschedule',
      // 首次调整才记录原值（避免二次调整覆盖原始）
      ...(checkin.originalScheduledDate === null
        ? { originalScheduledDate: checkin.scheduledDate, originalScheduledTime: checkin.scheduledTime }
      : {}),
    })
    return toCheckinDTO(updated)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      throw BusinessError.conflict('目标时间已有打卡记录')
    }
    throw err
  }
}

/**
 * 补录：事后补某天为已完成
 * - 若该槽位已有 missed 记录 → 转为 done，标记 makeup
 * - 若无记录 → 新建 done 记录，标记 source=retroactive
 */
export async function retroactiveDone(userId: number, planId: number, dto: RetroactiveDTO): Promise<Checkin> {
  const plan = await assertOwnPlan(userId, planId)
  const scheduledDate = new Date(dto.scheduledDate)
  const scheduledTime = dto.scheduledTime ?? null

  // 校验：补录只能补过去或今天，不能补未来日期
  const todayDate = new Date()
  todayDate.setHours(23, 59, 59, 999)
  if (scheduledDate > todayDate) {
    throw BusinessError.validation({ scheduledDate: '补录日期不能是未来' })
  }

  const existing = await checkinRepository.findByPlanAndSlot(plan.id, scheduledDate, scheduledTime)

  if (existing) {
    const wasMissed = existing.status === 'missed'
    const updated = await checkinRepository.update(existing.id, {
      status: 'done',
      actualTime: new Date(),
      source: 'retroactive',
      adjustmentType: wasMissed ? 'makeup' : existing.adjustmentType,
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    })
    await syncPlanCounts(plan.id)
    return toCheckinDTO(updated)
  }

  const created = await checkinRepository.create({
    plan: { connect: { id: plan.id } },
    user: { connect: { id: BigInt(userId) } },
    scheduledDate,
    scheduledTime,
    status: 'done',
    actualTime: new Date(),
    value: dto.value ?? null,
    remark: dto.remark ?? null,
    source: 'retroactive',
  })
  await syncPlanCounts(plan.id)
  return toCheckinDTO(created)
}

/** 列表（按日期/状态筛选） */
export async function listCheckins(userId: number, planId: number, opts: {
  startDate?: string
  endDate?: string
  status?: string
}) {
  await assertOwnPlan(userId, planId)
  const records = await checkinRepository.listByPlan(BigInt(planId), {
    startDate: opts.startDate ? new Date(opts.startDate) : undefined,
    endDate: opts.endDate ? new Date(opts.endDate) : undefined,
    status: opts.status,
  })
  return records.map(toCheckinDTO)
}

/** 日历视图（某月所有记录） */
export async function getCalendar(userId: number, planId: number, month?: string) {
  await assertOwnPlan(userId, planId)
  const now = new Date()
  const y = month ? parseInt(month.slice(0, 4)) : now.getFullYear()
  const m = month ? parseInt(month.slice(5, 7)) : now.getMonth() + 1
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)

  const records = await checkinRepository.listByPlan(BigInt(planId), { startDate, endDate })
  return {
    month: `${y}-${String(m).padStart(2, '0')}`,
    days: records.map(toCheckinDTO),
  }
}

/** 详情 */
export async function getCheckin(userId: number, checkinId: number): Promise<Checkin> {
  const checkin = await assertOwnCheckin(userId, checkinId)
  return toCheckinDTO(checkin)
}

/** 删除（软删，回退计数） */
export async function deleteCheckin(userId: number, checkinId: number): Promise<void> {
  const checkin = await assertOwnCheckin(userId, checkinId)
  await checkinRepository.softDelete(checkin.id)
  await syncPlanCounts(checkin.planId)
}
