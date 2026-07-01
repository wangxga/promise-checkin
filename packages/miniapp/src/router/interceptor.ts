/**
 * 路由拦截器：登录守卫
 * - 拦截 navigateTo / reLaunch / switchTab / redirectTo
 * - 白名单页面（如登录页）直接放行
 * - 未登录访问受保护页面 → 跳登录页
 */
import { useTokenStore } from '@/store/token'

/** 白名单：无需登录即可访问的页面 */
const WHITELIST = ['/pages/login/index']

export function setupRouteInterceptor() {
  const interceptors = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab']

  for (const method of interceptors) {
    uni.addInterceptor(method, {
      invoke(options: { url: string }) {
        const tokenStore = useTokenStore()
        const path = '/' + options.url.split('?')[0].replace(/^\//, '')

        // 白名单页面放行
        if (WHITELIST.some((p) => path.startsWith(p))) return options

        // 未登录 → 拦截，跳登录页
        if (!tokenStore.isLogin) {
          uni.reLaunch({ url: '/pages/login/index' })
          return false
        }
        return options
      },
    })
  }
}
