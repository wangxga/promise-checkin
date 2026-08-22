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
    /** 用户主动退出过：抑制启动时的静默自动登录，进游客态，
     *  直至用户再次手动登录（否则静默登录会让「退出登录」形同虚设） */
    const manualLogout = ref(false)

    const isLogin = computed(() => !!accessToken.value)

    function set(access: string, refresh: string) {
      accessToken.value = access
      refreshToken.value = refresh
      manualLogout.value = false
    }

    function clear() {
      accessToken.value = ''
      refreshToken.value = ''
    }

    /** 退出登录时调用：clear + 标记主动退出 */
    function markManualLogout() {
      clear()
      manualLogout.value = true
    }

    return { accessToken, refreshToken, manualLogout, isLogin, set, clear, markManualLogout }
  },
  { persist: true },
)
