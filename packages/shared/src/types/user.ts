/** 用户实体（对外返回的安全形态，不含敏感字段） */
export interface User {
  id: number
  openid: string
  nickname: string | null
  avatarUrl: string | null
  /** 脱敏手机号（138****1234），MVP 暂不采集 */
  phone: string | null
  status: number
  lastLoginAt: string | null
  createdAt: string
}
