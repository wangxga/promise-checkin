import pino from 'pino'
import { config } from '../config/index.js'

/**
 * 全局 logger 单例
 * - dev 环境用 pino-pretty 做人类可读输出
 * - prod 输出 JSON 便于日志收集
 */
export const logger = pino({
  level: config.log.level,
  ...(config.isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }),
})
