/**
 * Auth API — 鉴权相关接口
 * 只管"发请求 + 返回类型化数据"，业务逻辑在 store 层
 */
import { http } from '@/http/http'
import type { LoginInput, LoginResult, User } from '@promise-checkin/shared'

export const authApi = {
  /** 微信登录 */
  login: (data: LoginInput) => http.post<LoginResult>('/auth/login', data),

  /** 刷新 token */
  refresh: (refreshToken: string) =>
    http.post<LoginResult>('/auth/refresh', { refreshToken }),

  /** 当前用户信息 */
  getMe: () => http.get<User>('/auth/me'),

  /** 更新昵称和头像 */
  updateProfile: (data: { nickname?: string; avatarUrl?: string }) =>
    http.put<User>('/auth/profile', data),
}
