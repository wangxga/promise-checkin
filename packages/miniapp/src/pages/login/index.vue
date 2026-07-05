<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const loading = ref(false)

/** 跳隐私政策 */
function goPrivacy() {
  uni.navigateTo({ url: '/pages/agreement/privacy' })
}

async function handleLogin() {
  if (loading.value) return
  loading.value = true
  try {
    await userStore.login()
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/today/index' }), 600)
  } catch {
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="login-page">
    <view class="brand">
      <image class="logo" src="/static/app-logo.png" mode="aspectFit" />
      <text class="title">如约打卡</text>
      <text class="subtitle">打卡记录，一目了然</text>
    </view>
    <view class="action">
      <button class="login-btn" :loading="loading" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中...' : '微信一键登录' }}
      </button>
      <text class="agreement">登录即代表同意<text class="link" @click.stop="goPrivacy">《隐私政策》</text></text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100vh;
  padding: 200rpx 48rpx calc(80rpx + env(safe-area-inset-bottom));
  background: #fafafa;
  box-sizing: border-box;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.logo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 28rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}
.subtitle {
  font-size: 26rpx;
  color: #ababab;
}
.action {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  align-items: stretch;
  width: 100%;
}
.login-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 48rpx;
  border: none;
  text-align: center;
}
.login-btn::after {
  border: none;
}
.login-btn[disabled] {
  opacity: 0.6;
}
.agreement {
  font-size: 22rpx;
  color: #ababab;
  text-align: center;
}
.link {
  color: #007aff;
}
</style>
