/**
 * User Store — 用户业务状态
 * - 登录/登出/获取用户信息
 * - 依赖 token store 和 auth API
 * - 不直接发请求，调 api 层
 */
import { defineStore } from 'pinia'
import type { User, LoginResult } from '@promise-checkin/shared'
import { authApi } from '@/api/auth'
import { useTokenStore } from './token'

export const useUserStore = defineStore('user', () => {
  const profile = ref<User | null>(null)
  const isLogin = computed(() => !!profile.value)

  /**
   * 微信登录全流程
   * wx.login 拿 code → 调后端登录 → 存 token → 拉用户信息
   */
  async function login(): Promise<LoginResult> {
    // 1. wx.login 拿 code
    //    H5 / 开发者工具未配 AppID 时可能拿不到 code
    let code = ''
    try {
      const res = await uni.login({ provider: 'weixin' })
      code = res.code || ''
    } catch {
      // uni.login 失败（H5/未配 AppID），继续处理
    }
    // 开发环境才用占位 code（后端 dev 后门兜底）；生产环境必须拿到真实 code
    if (!code) {
      if (import.meta.env.DEV) {
        code = 'dev'
      } else {
        throw new Error('获取微信登录凭证失败，请重试')
      }
    }

    // 2. 获取用户资料（可选，失败不阻塞登录）
    let nickname: string | undefined
    let avatarUrl: string | undefined
    try {
      const userInfo = await uni.getUserProfile({ desc: '用于完善用户资料' })
      nickname = userInfo.userInfo.nickName
      avatarUrl = userInfo.userInfo.avatarUrl
    } catch {
      // 用户拒绝授权资料，正常继续
    }

    // 3. 调后端登录
    const result = await authApi.login({ code, nickname, avatarUrl })

    // 4. 存 token + 用户信息
    const tokenStore = useTokenStore()
    tokenStore.set(result.accessToken, result.refreshToken)
    profile.value = result.user

    return result
  }

  /** 从后端拉取最新用户信息 */
  async function fetchProfile() {
    const user = await authApi.getMe()
    profile.value = user
    return user
  }

  /**
   * 启动时恢复登录态
   * - 有 token：拉一次用户信息验证有效性；失效则清空并跳登录
   * - 无 token：跳登录页（冷启动直接进了 today 首页，需要主动引导）
   */
  function restoreToken() {
    const tokenStore = useTokenStore()
    if (!tokenStore.isLogin) {
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }
    fetchProfile().catch(() => {
      tokenStore.clear()
      profile.value = null
      uni.reLaunch({ url: '/pages/login/index' })
    })
  }

  /** 登出 */
  function logout() {
    const tokenStore = useTokenStore()
    tokenStore.clear()
    profile.value = null
    uni.reLaunch({ url: '/pages/login/index' })
  }

  return { profile, isLogin, login, fetchProfile, restoreToken, logout }
})
