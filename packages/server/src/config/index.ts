import 'dotenv/config'

/**
 * 应用配置
 * - 从环境变量读取，dev/prod 用 .env 隔离
 * - 启动时校验必填项，缺失立即抛错（fail fast）
 * - 导出单一 config 对象，模块内按需取值
 */

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback
  if (val === undefined) {
    throw new Error(`[config] 缺失必需的环境变量: ${key}`)
  }
  return val
}

function int(key: string, fallback: number): number {
  const v = process.env[key]
  return v ? parseInt(v, 10) : fallback
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',

  app: {
    port: int('PORT', 3000),
    /** API 路由前缀 */
    apiPrefix: '/api/v1',
    /** 允许的 CORS 来源（小程序场景为微信域名） */
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },

  db: {
    url: required(
      'DATABASE_URL',
      // 开发默认：本地 MySQL，库名 promise_checkin
      'mysql://promise_app:promise_app@localhost:3306/promise_checkin',
    ),
  },

  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: int('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: int('REDIS_DB', 0),
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev-secret-change-me-in-production-at-least-32-chars'),
    accessExpires: int('JWT_ACCESS_EXPIRES_SECONDS', 7 * 24 * 3600),
    refreshExpires: int('JWT_REFRESH_EXPIRES_SECONDS', 30 * 24 * 3600),
  },

  wx: {
    appId: process.env.WX_APPID ?? '',
    appSecret: process.env.WX_SECRET ?? '',
  },

  log: {
    level: process.env.LOG_LEVEL ?? 'info',
  },

  dev: {
    /**
     * 开发后门：登录时跳过微信 code2Session，直接用预设 openid 建用户签 token
     * - 仅非生产环境生效（NODE_ENV !== 'production'）
     * - 可用 DEV_AUTO_LOGIN=false 显式关闭（即使本地也想测真实微信登录时用）
     */
    autoLogin: process.env.NODE_ENV !== 'production' && process.env.DEV_AUTO_LOGIN !== 'false',
  },
} as const

export type Config = typeof config
