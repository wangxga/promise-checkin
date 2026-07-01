import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import App from './App.vue'
import { setupRequestInterceptor } from './http/interceptor'
import { setupRouteInterceptor } from './router/interceptor'

export function createApp() {
  const app = createSSRApp(App)

  // Pinia + 持久化（适配 uni storage）
  const pinia = createPinia()
  pinia.use(
    createPersistedState({
      storage: {
        getItem: (key: string) => uni.getStorageSync(key) || null,
        setItem: (key: string, value: string) => uni.setStorageSync(key, value),
      },
    }),
  )
  app.use(pinia)

  // 拦截器（请求 token 注入 + 路由登录守卫）
  setupRequestInterceptor()
  setupRouteInterceptor()

  return { app }
}
