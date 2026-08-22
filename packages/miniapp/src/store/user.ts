import { ref, computed } from 'vue'
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
   *
   * 说明：微信 2022.10 废弃 getUserProfile，登录时拿不到真实头像/昵称。
   * 后端会自动给新用户生成默认昵称（打卡者#xxxx）和默认头像，
   * 用户后续可在「我的」主动设置。
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

    // 2. 调后端登录（后端自动生成默认昵称/头像）
    const result = await authApi.login({ code })

    // 3. 存 token + 用户信息
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
   * 检查登录态，未登录或 token 失效则跳登录页
   * 在首页 onShow 里调用（onLaunch 太早，reLaunch 会被吞）
   */
  async function checkLogin() {
    const tokenStore = useTokenStore()
    if (!tokenStore.isLogin) {
      uni.reLaunch({ url: '/pages/login/index' })
      return false
    }
    try {
      await fetchProfile()
      return true
    } catch {
      tokenStore.clear()
      profile.value = null
      uni.reLaunch({ url: '/pages/login/index' })
      return false
    }
  }

  /** 启动时静默验证 token（不跳转，失败只清空）。
   *  用 silentAuthError 模式调 getMe，401 不触发全局 toLogin reLaunch，
   *  避免和用户主动操作（如点隐私政策 navigateTo）产生的页面跳转冲突 */
  function restoreToken() {
    const tokenStore = useTokenStore()
    if (tokenStore.isLogin) {
      authApi
        .getMe({ silentAuthError: true })
        .then((user) => {
          profile.value = user
        })
        .catch(() => {
          tokenStore.clear()
          profile.value = null
        })
    }
  }

  /** 登出 */
  function logout() {
    const tokenStore = useTokenStore()
    tokenStore.clear()
    profile.value = null
    uni.reLaunch({ url: '/pages/login/index' })
  }

  return { profile, isLogin, login, fetchProfile, restoreToken, checkLogin, logout }
})
