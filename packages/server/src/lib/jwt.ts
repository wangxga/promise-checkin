import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@promise-checkin/shared'

/**
 * JWT 签发/校验工具
 * - access token：短期，业务请求鉴权用
 * - refresh token：长期，access 过期后用它换新（type 字段防混用）
 */
export function signAccessToken(userId: number, openid: string): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = { userId, openid }
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpires,
  })
}

export function signRefreshToken(userId: number, openid: string): string {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    userId,
    openid,
    type: 'refresh',
  }
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpires,
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.secret) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, config.jwt.secret) as RefreshTokenPayload
  if (payload.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('not a refresh token')
  }
  return payload
}
