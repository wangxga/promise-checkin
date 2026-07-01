import { prisma } from '../../lib/prisma.js'
import type { Prisma } from '@prisma/client'

/**
 * Plan Repository — 数据访问层
 * 仅封装 Plan 表的查询/写入，返回 Prisma 原始模型，不含业务逻辑
 */

/** 查询时排除软删除的默认 where */
const notDeleted = { deletedAt: null } as const

export const planRepository = {
  /** 按 id 查（含未删除校验） */
  findById(id: bigint) {
    return prisma.plan.findFirst({ where: { id, ...notDeleted } })
  },

  /** 用户的所有进行中计划（分页 + 筛选） */
  findActiveByUser(
    userId: bigint,
    opts: {
      type?: string
      status?: string
      keyword?: string
      page: number
      pageSize: number
    },
  ) {
    const where: Prisma.PlanWhereInput = {
      userId,
      deletedAt: null,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.keyword ? { name: { contains: opts.keyword } } : {}),
    }
    return prisma.plan.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    })
  },

  /** 计数（分页 total） */
  countByUser(
    userId: bigint,
    opts: { type?: string; status?: string; keyword?: string },
  ) {
    return prisma.plan.count({
      where: {
        userId,
        deletedAt: null,
        ...(opts.type ? { type: opts.type } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.keyword ? { name: { contains: opts.keyword } } : {}),
      },
    })
  },

  /** 用户所有 fixed + active 计划（定时任务批量生成排期用） */
  findFixedActiveByUser(userId: bigint) {
    return prisma.plan.findMany({
      where: { userId, timeMode: 'fixed', status: 'active', deletedAt: null },
    })
  },

  create(data: Prisma.PlanCreateInput) {
    return prisma.plan.create({ data })
  },

  update(id: bigint, data: Prisma.PlanUpdateInput) {
    return prisma.plan.update({ where: { id }, data })
  },

  /** 软删除 */
  softDelete(id: bigint) {
    return prisma.plan.update({ where: { id }, data: { deletedAt: new Date() } })
  },

  /** 更新状态（归档/完成） */
  updateStatus(id: bigint, status: string) {
    return prisma.plan.update({ where: { id }, data: { status } })
  },

  /** 用户的已删除计划（回收站） */
  findDeletedByUser(userId: bigint) {
    return prisma.plan.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    })
  },

  /** 按 id 查（含已删除的，回收站恢复时用） */
  findByIdIncludingDeleted(id: bigint) {
    return prisma.plan.findUnique({ where: { id } })
  },

  /** 恢复（清除 deletedAt，同时恢复关联的 checkins） */
  restore(id: bigint) {
    return prisma.plan.update({ where: { id }, data: { deletedAt: null, status: 'active' } })
  },
}
