import cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { config } from '../config/index.js'
import { runScheduleGenerator } from './scheduleGenerator.js'
import { runOverdueScanner } from './overdueScanner.js'
import { runCountReconcile } from './countReconcile.js'

/**
 * 定时任务调度器
 * 注册排期生成 / 逾期扫描 / 计数校对三个任务
 *
 * 每个 job 独立 try-catch，失败只记日志不崩进程
 * 任务直接调 service 层逻辑（不走 HTTP），复用业务代码
 */

/** 包装：catch 错误 + 记日志 */
function wrapJob(name: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const start = Date.now()
    try {
      await fn()
      logger.debug({ ms: Date.now() - start }, `[job] ${name} 执行完毕`)
    } catch (err) {
      logger.error({ err, ms: Date.now() - start }, `[job] ${name} 执行失败`)
    }
  }
}

export function setupScheduler(): void {
  // 排期生成：每日凌晨 2:00
  cron.schedule('0 2 * * *', wrapJob('排期生成', runScheduleGenerator))

  // 逾期扫描：每小时整点
  cron.schedule('0 * * * *', wrapJob('逾期扫描', runOverdueScanner))

  // 计数校对：每日凌晨 3:00
  cron.schedule('0 3 * * *', wrapJob('计数校对', runCountReconcile))

  logger.info(
    `[job] 定时任务已注册：排期生成(每日2点) / 逾期扫描(每小时) / 计数校对(每日3点)`,
  )

  // dev 环境：启动时立即跑一次排期生成（方便测试，不影响 prod）
  if (config.dev.autoLogin) {
    logger.info('[job] dev 环境：启动时立即执行一次排期生成')
    setTimeout(() => wrapJob('排期生成(dev启动)', runScheduleGenerator)(), 2000)
  }
}
