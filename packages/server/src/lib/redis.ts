import Redis from 'ioredis'
import { config } from '../config/index.js'
import { logger } from './logger.js'

/**
 * Redis 单例
 * 用途：JWT 黑名单（登出）、接口限流计数、缓存
 * MVP 可选依赖：若连不上只告警不阻断（降级运行）
 */
let redisClient: Redis | null = null

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      // 避免连接失败直接崩进程，降级处理
      retryStrategy: (times) => Math.min(times * 200, 2000),
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    })
    redisClient.on('error', (err) => {
      logger.warn({ err }, '[redis] 连接异常（功能将降级）')
    })
    redisClient.on('connect', () => {
      logger.info('[redis] 已连接')
    })
  }
  return redisClient
}

/** 检查 Redis 是否可用（健康检查用） */
export async function isRedisAlive(): Promise<boolean> {
  try {
    const r = getRedis()
    const pong = await r.ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}
