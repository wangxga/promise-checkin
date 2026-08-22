import { authRepository } from './auth.repository.js'
import { resolveCode } from '../../lib/devtool.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js'
import { BusinessError } from '../../shared-utils/errors.js'
import { logger } from '../../lib/logger.js'
import { config } from '../../config/index.js'
import { randomBytes } from 'node:crypto'
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
 * 生成默认昵称：打卡者#xxxx（4 位 hex，避免碰撞也不可猜测）
 */
function generateDefaultNickname(): string {
  return `打卡者#${randomBytes(2).toString('hex')}`
}

/**
 * 默认头像 URL（随镜像分发的静态文件）
 */
function defaultAvatarUrl(): string {
  return `${config.upload.urlPrefix}/default-avatar.png`
}

/**
 * 判断昵称是否为无效值（需要回填默认值）
 * - 空/null
 * - "微信用户"（getUserProfile 废弃后返回的固定匿名值）
 * - "昵称"等明显占位
 */
function isInvalidNickname(nickname: string | null): boolean {
  if (!nickname) return true
  const trimmed = nickname.trim()
  if (!trimmed) return true
  // getUserProfile 废弃后的匿名垃圾值
  const ANONYMOUS_NAMES = ['微信用户', '昵称']
  return ANONYMOUS_NAMES.includes(trimmed)
}

/**
 * 判断头像 URL 是否为无效值（需要回填默认值）
 * - 空/null
 * - 微信默认灰头像（thirdwx.qlogo.cn 的 132 尺寸默认图）
 */
function isInvalidAvatarUrl(avatarUrl: string | null): boolean {
  if (!avatarUrl) return true
  const trimmed = avatarUrl.trim()
  if (!trimmed) return true
  // getUserProfile 废弃后返回的微信默认灰头像 URL
  return trimmed.includes('thirdwx.qlogo.cn')
}

/**
 * 登录
 * code → code2Session 换 openid → 查建 user → 签发双 token
 *
 * 说明：微信 2022.10 起废弃了 getUserProfile，登录时拿不到真实头像/昵称。
 * 新用户统一给默认昵称 + 默认头像，用户后续可在「我的」主动设置。
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
      nickname: generateDefaultNickname(),
      avatarUrl: defaultAvatarUrl(),
      lastLoginAt: new Date(),
    })
    isNewUser = true
    logger.info({ userId: user.id, openid: session.openid }, '[auth] 新用户注册')
  } else {
    // 已有用户：更新最后登录时间（异步即可，不阻塞响应）
    authRepository.updateLastLogin(user.id).catch((e) =>
      logger.warn({ err: e }, '[auth] 更新 lastLoginAt 失败'),
    )
    // 老用户兜底：历史数据可能 nickname/avatarUrl 是 getUserProfile 废弃后的匿名垃圾值
    // （"微信用户" + thirdwx.qlogo.cn 默认灰头像），登录时补上默认值
    if (isInvalidNickname(user.nickname) || isInvalidAvatarUrl(user.avatarUrl)) {
      user = await authRepository.updateProfile(user.id, {
        nickname: isInvalidNickname(user.nickname) ? generateDefaultNickname() : user.nickname!,
        avatarUrl: isInvalidAvatarUrl(user.avatarUrl) ? defaultAvatarUrl() : user.avatarUrl!,
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
