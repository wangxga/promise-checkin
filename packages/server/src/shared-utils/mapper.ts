import type { Plan, Checkin, PlanProgress, ScheduleConfig } from '@promise-checkin/shared'
import type { Plan as PrismaPlan, Checkin as PrismaCheckin } from '@prisma/client'

/**
 * Mapper：Prisma 模型 → 对外 DTO
 * 隐藏 Prisma 内部结构（BigInt/Date 等），转成 JSON 友好的形态
 * 业务层不直接接触 Prisma 对象，保证解耦
 */

/** Plan: Prisma → DTO */
export function toPlanDTO(p: PrismaPlan): Plan {
  return {
    id: Number(p.id),
    userId: Number(p.userId),
    familyId: p.familyId ? Number(p.familyId) : null,
    name: p.name,
    type: p.type as Plan['type'],
    color: p.color,
    totalCount: p.totalCount,
    initialDoneCount: p.initialDoneCount,
    doneCount: p.doneCount,
    missedCount: p.missedCount,
    absenceConsumes: p.absenceConsumes,
    timeMode: p.timeMode as Plan['timeMode'],
    scheduleConfig: (p.scheduleConfig as unknown as ScheduleConfig) ?? null,
    overdueHandling: p.overdueHandling as Plan['overdueHandling'],
    overdueGraceHours: p.overdueGraceHours,
    recordValue: p.recordValue,
    valueUnit: p.valueUnit,
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
    endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
    status: p.status as Plan['status'],
    remark: p.remark,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    deletedAt: p.deletedAt?.toISOString() ?? null,
  }
}

/** Checkin: Prisma → DTO */
export function toCheckinDTO(c: PrismaCheckin): Checkin {
  return {
    id: Number(c.id),
    planId: Number(c.planId),
    userId: Number(c.userId),
    memberId: c.memberId ? Number(c.memberId) : null,
    scheduledDate: c.scheduledDate.toISOString().slice(0, 10),
    scheduledTime: c.scheduledTime,
    status: c.status as Checkin['status'],
    actualTime: c.actualTime?.toISOString() ?? null,
    value: c.value !== null ? Number(c.value) : null,
    remark: c.remark,
    source: c.source as Checkin['source'],
    adjustmentType: (c.adjustmentType as Checkin['adjustmentType']) ?? null,
    originalScheduledDate: c.originalScheduledDate
      ? c.originalScheduledDate.toISOString().slice(0, 10)
      : null,
    originalScheduledTime: c.originalScheduledTime,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  }
}

/**
 * 计算计划进度（多口径计数派生，从 demo 移植）
 * - totalDone = initialDoneCount + doneCount
 * - consumed = totalDone + (absenceConsumes ? missedCount : 0)，无限计划为 null
 * - remain = totalCount - consumed，无限计划为 null
 * - progress = consumed / totalCount，无限计划为 null
 */
export function calcProgress(plan: {
  totalCount: number | null
  initialDoneCount: number
  doneCount: number
  missedCount: number
  absenceConsumes: boolean
}): PlanProgress {
  const totalDone = plan.initialDoneCount + plan.doneCount
  if (plan.totalCount === null) {
    return { totalDone, consumed: null, remain: null, progress: null }
  }
  const consumed = totalDone + (plan.absenceConsumes ? plan.missedCount : 0)
  return {
    totalDone,
    consumed,
    remain: plan.totalCount - consumed,
    progress: plan.totalCount > 0 ? consumed / plan.totalCount : 0,
  }
}
