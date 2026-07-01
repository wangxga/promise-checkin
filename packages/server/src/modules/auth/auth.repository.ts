import { prisma } from '../../lib/prisma.js'
import type { Prisma } from '@prisma/client'

/**
 * Auth Repository — 数据访问层
 * 职责：仅封装 User 表的查询/写入，返回 Prisma 原始模型
 * 不含业务逻辑，不接触 HTTP
 */
export const authRepository = {
  /** 按 openid 查用户 */
  findByOpenid(openid: string) {
    return prisma.user.findUnique({ where: { openid } })
  },

  /** 创建新用户（首次登录） */
  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data })
  },

  /** 更新最后登录时间 */
  updateLastLogin(userId: bigint) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
  },

  /** 更新用户资料（昵称/头像） */
  updateProfile(
    userId: bigint,
    data: { nickname?: string; avatarUrl?: string },
  ) {
    return prisma.user.update({ where: { id: userId }, data })
  },

  /** 按 id 查用户 */
  findById(userId: bigint) {
    return prisma.user.findUnique({ where: { id: userId } })
  },
}
