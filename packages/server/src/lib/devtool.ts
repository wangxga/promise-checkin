import { config } from '../config/index.js'
import { code2Session, type Code2SessionResult } from './wechat.js'

/**
 * 开发后门（dev tooling）
 *
 * 设计：把"是否走 mock"的逻辑收敛在这里，业务层（auth.service）只调 resolveCode，
 * 无需感知当前是 dev 还是 prod。生产环境代码路径里没有任何 mock 分支。
 *
 * 安全边界：config.dev.autoLogin 在 NODE_ENV=production 时恒为 false（见 config），
 * 此文件的所有 mock 行为都被 isDevAutoLogin() 守卫，无法在生产绕过。
 */

/** dev 后门用的固定 mock openid（与 seed.ts 的种子用户一致） */
const DEV_MOCK_OPENID = 'dev-mock-openid-123456'

/** dev 后门是否开启 */
export function isDevAutoLogin(): boolean {
  return config.dev.autoLogin
}

/**
 * 解析登录 code → 返回 session
 * - dev 后门开启：忽略 code，返回 mock session（不调微信）
 * - 否则：走真实 code2Session
 *
 * 这样 auth.service 只需调 resolveCode，不用关心环境
 */
export async function resolveCode(code: string): Promise<Code2SessionResult> {
  if (isDevAutoLogin()) {
    return {
      openid: DEV_MOCK_OPENID,
      session_key: 'dev-mock-session-key',
    }
  }
  return code2Session(code)
}
