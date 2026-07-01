import { prisma } from '../../lib/prisma.js'
import type { Prisma } from '@prisma/client'

/**
 * Checkin Repository — 数据访问层
 * 仅封装 Checkin 表的查询/写入，不含业务逻辑
 */

const notDeleted = { deletedAt: null } as const

export const checkinRepository = {
  findById(id: bigint) {
    return prisma.checkin.findFirst({ where: { id, ...notDeleted } })
  },

  /** 按 planId + date + time 查（唯一） */
  findByPlanAndSlot(planId: bigint, scheduledDate: Date, scheduledTime: string | null) {
    return prisma.checkin.findFirst({
      where: {
        planId,
        scheduledDate,
        scheduledTime,
        deletedAt: null,
      },
    })
  },

  /** 计划的打卡记录列表（按日期范围 + 状态筛选） */
  listByPlan(
    planId: bigint,
    opts: { startDate?: Date; endDate?: Date; status?: string } = {},
  ) {
    return prisma.checkin.findMany({
      where: {
        planId,
        deletedAt: null,
        ...(opts.startDate || opts.endDate
          ? {
              scheduledDate: {
                ...(opts.startDate ? { gte: opts.startDate } : {}),
                ...(opts.endDate ? { lte: opts.endDate } : {}),
              },
            }
          : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { scheduledDate: 'asc' },
    })
  },

  /** 某计划某状态的记录数（计数校对用） */
  countByPlanAndStatus(planId: bigint, status: string) {
    return prisma.checkin.count({ where: { planId, status, deletedAt: null } })
  },

  /** 用户的某状态记录（统计/缺席列表用） */
  listByUserAndStatus(
    userId: bigint,
    status: string,
    opts: { page: number; pageSize: number } = { page: 1, pageSize: 20 },
  ) {
    return prisma.checkin.findMany({
      where: { userId, status, deletedAt: null },
      orderBy: { scheduledDate: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { plan: { select: { name: true, type: true, color: true } } },
    })
  },

  countByUserAndStatus(userId: bigint, status: string) {
    return prisma.checkin.count({ where: { userId, status, deletedAt: null } })
  },

  create(data: Prisma.CheckinCreateInput) {
    return prisma.checkin.create({ data })
  },

  update(id: bigint, data: Prisma.CheckinUpdateInput) {
    return prisma.checkin.update({ where: { id }, data })
  },

  /** 软删除 */
  softDelete(id: bigint) {
    return prisma.checkin.update({ where: { id }, data: { deletedAt: new Date() } })
  },

  /** 按计划软删除所有（删计划时连带） */
  softDeleteByPlan(planId: bigint) {
    return prisma.checkin.updateMany({
      where: { planId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  },

  /** 事务专用：upsert by slot（性能优于先查后插） */
  upsertBySlot(
    tx: Prisma.TransactionClient,
    planId: bigint,
    userId: bigint,
    scheduledDate: Date,
    scheduledTime: string | null,
    data: Prisma.CheckinUpdateInput,
  ) {
    return tx.checkin.upsert({
      where: {
        planId_scheduledDate_scheduledTime: {
          planId,
          scheduledDate,
          scheduledTime: scheduledTime ?? '',
        },
      },
      create: {
        planId,
        userId,
        scheduledDate,
        scheduledTime,
        status: data.status as string,
        actualTime: (data.actualTime as Date) ?? null,
        value: (data.value as number) ?? null,
        remark: (data.remark as string) ?? null,
        source: (data.source as string) ?? 'scheduled',
        adjustmentType: (data.adjustmentType as string) ?? null,
      },
      update: data,
    })
  },
}
