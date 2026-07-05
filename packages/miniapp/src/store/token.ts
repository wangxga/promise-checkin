import { ref, computed } from 'vue'
/**
 * Token Store — 纯 token 管理
 * - 持久化到 uni storage（跨会话保留登录态）
 * - 不含业务逻辑，user store 和 http 层依赖它
 */
import { defineStore } from 'pinia'

export const useTokenStore = defineStore(
  'token',
  () => {
    const accessToken = ref<string>('')
    const refreshToken = ref<string>('')

    const isLogin = computed(() => !!accessToken.value)

    function set(access: string, refresh: string) {
      accessToken.value = access
      refreshToken.value = refresh
    }

    function clear() {
      accessToken.value = ''
      refreshToken.value = ''
    }

    return { accessToken, refreshToken, isLogin, set, clear }
  },
  { persist: true },
)
