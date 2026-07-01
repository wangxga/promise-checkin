import type { Context, Next } from 'koa'
import { verifyAccessToken } from '../lib/jwt.js'
import { BusinessError } from '../shared-utils/errors.js'

/**
 * JWT 鉴权中间件
 * - 白名单路径直接放行（登录、刷新、健康检查）
 * - 其余请求校验 Authorization: Bearer <token>，注入 ctx.state.userId
 * - Controller 通过 ctx.state.userId 拿当前用户，不直接接触 token
 */

/** 无需鉴权的路径白名单
 * - /auth/login、/auth/refresh：相对 apiPrefix 的业务路径
 * - /health：根路径健康检查（不经过 apiPrefix），直接按完整路径匹配
 */
const WHITELIST = new Set(['/auth/login', '/auth/refresh', '/health'])

/** 判断是否在白名单 */
function isWhitelisted(path: string, apiPrefix: string): boolean {
  // 根路径白名单（如 /health）直接匹配完整路径
  if (WHITELIST.has(path)) return true
  // apiPrefix 下业务白名单：去掉前缀后匹配
  const rel = path.startsWith(apiPrefix) ? path.slice(apiPrefix.length) : path
  return WHITELIST.has(rel)
}

export function jwtMiddleware(apiPrefix: string) {
  return async (ctx: Context, next: Next): Promise<void> => {
    // 白名单放行
    if (isWhitelisted(ctx.path, apiPrefix)) {
      await next()
      return
    }

    const auth = ctx.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      throw BusinessError.unauthorized()
    }
    const token = auth.slice(7)
    try {
      const payload = verifyAccessToken(token)
      ctx.state.userId = payload.userId
      ctx.state.openid = payload.openid
    } catch {
      // token 过期或无效，统一抛 1001（前端据此刷新或跳登录）
      throw BusinessError.unauthorized('token 已过期或无效')
    }
    await next()
  }
}
