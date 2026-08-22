import dotenv from 'dotenv'
import path from 'node:path'

// 两层加载：先读 .env 拿 NODE_ENV，再加载 .env.{NODE_ENV}
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const nodeEnv = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) })

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
    // 生产环境必须设置 JWT_SECRET（无 fallback，缺失即崩）
    // 开发环境用固定密钥兜底
    secret:
      nodeEnv === 'production'
        ? required('JWT_SECRET')
        : process.env.JWT_SECRET || 'dev-secret-change-me-in-production-at-least-32-chars',
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

  upload: {
    /** 文件存储根目录（绝对路径）。容器内 cwd=/app，默认 /app/uploads */
    dir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
    /** 静态访问 URL 前缀。头像 URL 形如 {urlPrefix}/{userId}/{随机}.png */
    urlPrefix: process.env.UPLOAD_URL_PREFIX ?? '/uploads',
    /** 单文件大小上限（字节），默认 5MB */
    maxFileSize: int('UPLOAD_MAX_SIZE', 5 * 1024 * 1024),
    /** 允许的 MIME 类型（白名单）。放宽为 string[]，避免 as const 导致 multer 类型不兼容 */
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as string[],
  },
} as const

export type Config = typeof config
