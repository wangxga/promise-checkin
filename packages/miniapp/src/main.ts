import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import App from './App.vue'
import { setupRequestInterceptor } from './http/interceptor'

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

  // 请求拦截器（token 注入）。
  // 路由登录守卫已移除：登录后置模式——游客可自由浏览所有页面，
  // 只在产生数据的动作处（保存计划/打卡等）用 userStore.ensureLogin() 拦截
  setupRequestInterceptor()

  return { app }
}
