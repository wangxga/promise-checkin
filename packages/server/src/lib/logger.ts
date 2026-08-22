import { pino } from 'pino'
import type { LoggerOptions } from 'pino'
import { config } from '../config/index.js'

/**
 * 全局 logger 单例
 * - dev：pino-pretty 彩色输出到控制台
 * - prod：JSON 输出到控制台 + 日志文件（PM2 也会接管 stdout 重定向到文件）
 */
const loggerOptions: LoggerOptions = {
  level: config.log.level,
}

if (!config.isProd) {
  // 开发环境：彩色控制台输出
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  }
}

export const logger = pino(loggerOptions)
