/**
 * 请求拦截器：用 uni.addInterceptor 在请求发送前注入 token
 * 解耦：业务代码调 uni.request 不需要关心 token，拦截器统一处理
 */
import { useTokenStore } from '@/store/token'

const BASE_URL = import.meta.env.VITE_SERVER_BASEURL || ''

export function setupRequestInterceptor() {
  const injectAuth = {
    invoke(options: Record<string, unknown>) {
      const url = options.url as string
      // 非 http 开头的相对路径拼上 BASE_URL
      if (!url.startsWith('http')) {
        options.url = BASE_URL + url
      }
      // 注入 token
      const tokenStore = useTokenStore()
      const token = tokenStore.accessToken
      if (token) {
        options.header = {
          ...(options.header as Record<string, string>),
          Authorization: `Bearer ${token}`,
          'X-Client': 'miniapp',
        }
      }
      return options
    },
  }

  uni.addInterceptor('request', injectAuth)
  uni.addInterceptor('uploadFile', injectAuth)
}
