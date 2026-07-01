<script setup lang="ts">
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : '登录失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">✓</view>
      <text class="title">如约打卡</text>
      <text class="subtitle">通用按计划打卡 + 缺席追溯</text>
    </view>
    <view class="action">
      <wd-button type="primary" size="large" block :loading="loading" @click="handleLogin">
        微信一键登录
      </wd-button>
      <text class="agreement">登录即代表同意<text class="link" @click.stop="goPrivacy">《隐私政策》</text></text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  padding: 120rpx 48rpx 80rpx;
  background: #fafafa;
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
  background: #1a1a1a;
  color: #fff;
  font-size: 64rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
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
