import type { User } from './user.js'

/** POST /auth/login 请求体 */
export interface LoginInput {
  /** wx.login() 拿到的 code */
  code: string
  /** 用户授权后的昵称（可选） */
  nickname?: string
  /** 用户授权后的头像 URL（可选） */
  avatarUrl?: string
}

/** POST /auth/login 响应体 */
export interface LoginResult {
  accessToken: string
  refreshToken: string
  /** access token 有效期（秒） */
  expiresIn: number
  user: User
  /** 是否首次登录（首次自动创建用户） */
  isNewUser: boolean
}

/** POST /auth/refresh 请求体 */
export interface RefreshInput {
  refreshToken: string
}

/** POST /auth/refresh 响应体：同 LoginResult */
export type RefreshResult = LoginResult

/** JWT access token 的 payload */
export interface AccessTokenPayload {
  userId: number
  openid: string
  iat: number
  exp: number
}

/** JWT refresh token 的 payload（比 access 多个 type 标识） */
export interface RefreshTokenPayload extends AccessTokenPayload {
  type: 'refresh'
}
