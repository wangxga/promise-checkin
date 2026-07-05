<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { statsApi, type MissedItem } from '@/api/stats'

const list = ref<MissedItem[]>([])
const total = ref(0)
const loading = ref(false)

onShow(() => {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    const res = await statsApi.missed({ pageSize: 100 })
    list.value = res.list
    total.value = res.total
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">缺席记录</text>
      <text class="count">共 {{ total }} 条</text>
    </view>

    <view v-if="loading && !list.length" class="loading">
      <wd-loading />
    </view>

    <view v-else-if="list.length" class="rows">
      <view v-for="item in list" :key="item.id" class="item">
        <view class="dot" :style="{ background: item.planColor }" />
        <view class="main">
          <text class="name">{{ item.planName }}</text>
          <text class="sub">{{ item.scheduledDate }} {{ item.scheduledTime || '' }} · {{ item.remark || '无备注' }}</text>
        </view>
        <text v-if="item.adjustmentType === 'makeup'" class="tag makeup">已补</text>
        <text v-else class="tag missed">缺</text>
      </view>
    </view>

    <view v-else class="empty">
      <view class="check-icon">✓</view>
      <text class="empty-text">暂无缺席记录</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding-bottom: 40rpx;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40rpx 32rpx 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
}
.count {
  font-size: 24rpx;
  color: #ababab;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 120rpx 0;
}
.rows {
  padding: 0 32rpx;
}
.item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  background: #fff;
  border-radius: 24rpx;
  margin-bottom: 16rpx;
}
.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  flex-shrink: 0;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
}
.sub {
  font-size: 24rpx;
  color: #ababab;
}
.tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.tag.makeup {
  background: rgba(175, 82, 222, 0.1);
  color: #af52de;
}
.tag.missed {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
  color: #ababab;
}
.check-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 4rpx solid #34c759;
  color: #34c759;
  font-size: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
}
</style>
