<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const loading = ref(false)
const agreed = ref(false)

/** 跳隐私政策 */
function goPrivacy() {
  uni.navigateTo({ url: '/pages/agreement/privacy' })
}

async function handleLogin() {
  if (loading.value) return
  if (!agreed.value) {
    uni.showToast({ title: '请先阅读并同意隐私政策', icon: 'none' })
    return
  }
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
      <view class="agree-row">
        <view class="checkbox" :class="{ checked: agreed }" @click="agreed = !agreed">
          <text v-if="agreed" class="check-mark">✓</text>
        </view>
        <text class="agreement" @click="agreed = !agreed">我已阅读并同意<text class="link" @click.stop="goPrivacy">《隐私政策》</text></text>
      </view>
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
.agree-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}
.checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #c7c7cc;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.checkbox.checked {
  background: #1a1a1a;
  border-color: #1a1a1a;
}
.check-mark {
  color: #fff;
  font-size: 20rpx;
}
.agreement {
  font-size: 22rpx;
  color: #ababab;
}
.link {
  color: #007aff;
}
</style>
