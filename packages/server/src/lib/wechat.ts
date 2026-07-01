import { config } from '../config/index.js'
import { BusinessError } from '../shared-utils/errors.js'
import { logger } from './logger.js'

/** code2Session 返回 */
export interface Code2SessionResult {
  openid: string
  session_key: string
  unionid?: string
}

/**
 * 微信小程序 code2Session
 * 用前端传来的 code 换 openid + session_key
 *
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
 */
export async function code2Session(code: string): Promise<Code2SessionResult> {
  if (!config.wx.appId || !config.wx.appSecret) {
    throw BusinessError.internal(
      '微信小程序配置缺失（WX_APPID / WX_SECRET），无法完成登录',
    )
  }

  const url =
    `https://api.weixin.qq.com/sns/jscode2session` +
    `?appid=${config.wx.appId}` +
    `&secret=${config.wx.appSecret}` +
    `&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`

  const resp = await fetch(url)
  const data = (await resp.json()) as {
    openid?: string
    session_key?: string
    unionid?: string
    errcode?: number
    errmsg?: string
  }

  if (data.errcode || !data.openid) {
    logger.warn({ errcode: data.errcode, errmsg: data.errmsg }, '[wechat] code2Session 失败')
    throw BusinessError.unauthorized(`微信登录失败: ${data.errmsg ?? '未知错误'}`)
  }

  return {
    openid: data.openid,
    session_key: data.session_key!,
    unionid: data.unionid,
  }
}
