import { authRepository } from './auth.repository.js'
import { resolveCode } from '../../lib/devtool.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js'
import { BusinessError } from '../../shared-utils/errors.js'
import { logger } from '../../lib/logger.js'
import { config } from '../../config/index.js'
import type { LoginResult, User } from '@promise-checkin/shared'
import type { LoginDTO } from './auth.dto.js'

/**
 * Auth Service — 业务逻辑层
 * 职责：登录流程编排、token 签发/刷新、用户信息组装
 * 不接触 HTTP（无 ctx），可被 Controller 和定时任务复用
 */

/** 把 Prisma User 模型转成对外的 User DTO（隐藏内部细节） */
function toUserDTO(u: {
  id: bigint
  openid: string
  nickname: string | null
  avatarUrl: string | null
  phone: string | null
  status: number
  lastLoginAt: Date | null
  createdAt: Date
}): User {
  return {
    id: Number(u.id),
    openid: u.openid,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    status: u.status,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }
}

/**
 * 登录
 * code → code2Session 换 openid → 查建 user → 签发双 token
 */
export async function login(dto: LoginDTO): Promise<LoginResult> {
  // 1. code 换 openid（dev 后门开启时跳过微信，返回 mock openid）
  const session = await resolveCode(dto.code)

  // 2. 查或建用户
  let user = await authRepository.findByOpenid(session.openid)
  let isNewUser = false
  if (!user) {
    user = await authRepository.create({
      openid: session.openid,
      unionid: session.unionid,
      nickname: dto.nickname ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      lastLoginAt: new Date(),
    })
    isNewUser = true
    logger.info({ userId: user.id, openid: session.openid }, '[auth] 新用户注册')
  } else {
    // 已有用户：更新最后登录时间（异步即可，不阻塞响应）
    authRepository.updateLastLogin(user.id).catch((e) =>
      logger.warn({ err: e }, '[auth] 更新 lastLoginAt 失败'),
    )
    // 若前端带了新昵称/头像，顺便更新
    if (dto.nickname || dto.avatarUrl) {
      user = await authRepository.updateProfile(user.id, {
        nickname: dto.nickname,
        avatarUrl: dto.avatarUrl,
      })
    }
  }

  // 3. 禁用用户拦截
  if (user.status === 0) {
    throw BusinessError.forbidden('账号已被禁用')
  }

  // 4. 签发双 token
  const accessToken = signAccessToken(Number(user.id), user.openid)
  const refreshToken = signRefreshToken(Number(user.id), user.openid)

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessExpires,
    user: toUserDTO(user),
    isNewUser,
  }
}

/**
 * 刷新 token
 * 用 refresh token 换新的 access + refresh
 */
export async function refresh(refreshToken: string): Promise<LoginResult> {
  const payload = verifyRefreshToken(refreshToken)
  const user = await authRepository.findById(BigInt(payload.userId))
  if (!user || user.status === 0) {
    throw BusinessError.unauthorized('用户不存在或已禁用')
  }

  const newAccess = signAccessToken(Number(user.id), user.openid)
  const newRefresh = signRefreshToken(Number(user.id), user.openid)

  return {
    accessToken: newAccess,
    refreshToken: newRefresh,
    expiresIn: config.jwt.accessExpires,
    user: toUserDTO(user),
    isNewUser: false,
  }
}

/**
 * 获取当前用户信息
 */
export async function getMe(userId: number): Promise<User> {
  const user = await authRepository.findById(BigInt(userId))
  if (!user) {
    throw BusinessError.notFound('用户不存在')
  }
  return toUserDTO(user)
}

/**
 * 更新用户资料（昵称/头像）
 */
export async function updateProfile(
  userId: number,
  data: { nickname?: string; avatarUrl?: string },
): Promise<User> {
  const user = await authRepository.findById(BigInt(userId))
  if (!user) {
    throw BusinessError.notFound('用户不存在')
  }
  const updated = await authRepository.updateProfile(BigInt(userId), data)
  return toUserDTO(updated)
}
