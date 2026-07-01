import Router from '@koa/router'
import { config } from '../config/index.js'
import { ok } from '../shared-utils/response.js'
import { isDbAlive } from '../lib/prisma.js'
import { isRedisAlive } from '../lib/redis.js'
import { authRouter } from '../modules/auth/auth.controller.js'
import { planRouter } from '../modules/plan/plan.controller.js'
import {
  planCheckinRouter,
  checkinRouter,
} from '../modules/checkin/checkin.controller.js'
import { statsRouter, planProgressRouter } from '../modules/stats/stats.controller.js'

/**
 * 路由聚合
 * - /health 在根路径，不走 apiPrefix，不需鉴权（运维监控用）
 * - 业务路由挂在 apiPrefix（/api/v1）下
 *
 * 注意路由顺序：planCheckinRouter 和 planProgressRouter 的路径（/plans/:id/...）
 * 必须在 planRouter 之前注册，避免被 planRouter 的 /plans/:id 捕获
 */
export const rootRouter = new Router()

// 健康检查（根路径）
rootRouter.get('/health', async (ctx) => {
  const [db, redis] = await Promise.all([isDbAlive(), isRedisAlive()])
  ok(ctx, {
    status: 'ok',
    uptime: process.uptime(),
    deps: { db, redis },
    timestamp: new Date().toISOString(),
  })
})

// 业务路由（统一挂到 apiPrefix 下）
const apiRouter = new Router({ prefix: config.app.apiPrefix })

// 先注册带子路径的（避免被通用路由捕获）
apiRouter.use(planCheckinRouter.routes()).use(planCheckinRouter.allowedMethods())
apiRouter.use(planProgressRouter.routes()).use(planProgressRouter.allowedMethods())
// 再注册模块路由
apiRouter.use(authRouter.routes()).use(authRouter.allowedMethods())
apiRouter.use(planRouter.routes()).use(planRouter.allowedMethods())
apiRouter.use(checkinRouter.routes()).use(checkinRouter.allowedMethods())
apiRouter.use(statsRouter.routes()).use(statsRouter.allowedMethods())

rootRouter.use(apiRouter.routes()).use(apiRouter.allowedMethods())
