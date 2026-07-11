import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import { config } from './config/index.js'
import { logger } from './lib/logger.js'
import { isDevAutoLogin } from './lib/devtool.js'
import { setupScheduler } from './jobs/scheduler.js'
import { errorHandler } from './middlewares/error.js'
import { requestLogger } from './middlewares/logger.js'
import { rateLimit } from './middlewares/rateLimit.js'
import { jwtMiddleware } from './middlewares/jwt.js'
import { rootRouter } from './routes/index.js'

/**
 * 应用入口
 * 中间件洋葱顺序（外→内）：
 *   errorHandler → requestLogger → cors → bodyParser → jwt → router
 *
 * 说明：
 * - errorHandler 必须最外层，兜底所有后续中间件抛出的错误
 * - jwt 在 router 之前，白名单在 jwt 内部判断
 */
const app = new Koa()
app.proxy = true

// 洋葱：从外到内
app.use(errorHandler)
app.use(requestLogger)
app.use(
  cors({
    origin: config.app.corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Client'],
  }),
)
app.use(
  bodyParser({
    enableTypes: ['json'],
    jsonLimit: '1mb',
  }),
)

// 限流（Redis 滑窗，Redis 不可用时降级放行）
app.use(rateLimit)

// JWT 鉴权（白名单内部处理，不需要的话直接放行）
app.use(jwtMiddleware(config.app.apiPrefix))

// 路由
app.use(rootRouter.routes()).use(rootRouter.allowedMethods())

// 启动
app.listen(config.app.port, () => {
  logger.info(
    `🚀 如约打卡后端已启动: http://localhost:${config.app.port} (${config.env})`,
  )
  logger.info(`   健康检查: http://localhost:${config.app.port}/health`)
  logger.info(`   API 前缀: ${config.app.apiPrefix}`)
  if (isDevAutoLogin()) {
    logger.warn(
      `   [dev] 已开启后门：登录时 POST /api/v1/auth/login 无需真实 code（生产环境自动关闭）`,
    )
  }
  // 注册定时任务
  setupScheduler()
})

export default app
