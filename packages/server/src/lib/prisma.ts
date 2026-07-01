import { PrismaClient } from '@prisma/client'

/**
 * PrismaClient 单例
 * - dev 环境挂在 global 上避免 tsx watch 热重载时连接泄漏
 * - 全局唯一实例，各 repository 复用
 * - warn/error 通过 Prisma 的函数式 logger 直接输出到 pino
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
    ],
  })

if (globalForPrisma.prisma === undefined) {
  globalForPrisma.prisma = prisma
}

/** 检查 DB 是否可用（健康检查用） */
export async function isDbAlive(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}
