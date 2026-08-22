<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { usePlanStore } from '@/store/plan'
import { useUserStore } from '@/store/user'
import { progressText, remain, totalDone } from '@/utils/progress'
import type { Plan } from '@promise-checkin/shared'

const planStore = usePlanStore()
const userStore = useUserStore()

onShow(() => {
  // 游客不拉数据（列表自然呈现空状态引导创建）；保存计划时才 ensureLogin
  if (!userStore.isLogin) return
  planStore.fetchPlans()
})

/** 跳计划详情 */
function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/plan/detail?id=${id}` })
}

/** 跳新建 */
function goCreate() {
  uni.navigateTo({ url: '/pages/plan/edit' })
}

/** 计划卡片右侧进度文字 */
function planMeta(plan: Plan): string {
  const r = remain(plan)
  if (r !== null) {
    return `剩 ${r} · ${progressText(plan)}`
  }
  return `已完成 ${totalDone(plan)} 次`
}

/** 类型标签 */
function typeLabel(type: string): string {
  const map: Record<string, string> = {
    course: '课程',
    medicine: '服药',
    measure: '测量',
    fitness: '运动',
    learning: '学习',
    custom: '自定义',
  }
  return map[type] || type
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">我的计划</text>
      <view class="add-btn" @tap="goCreate">
        <view class="plus-h" />
        <view class="plus-v" />
      </view>
    </view>

    <view v-if="planStore.loading && !planStore.plans.length" class="loading">
      <wd-loading />
    </view>

    <view v-else-if="planStore.plans.length" class="rows">
      <view
        v-for="plan in planStore.plans"
        :key="plan.id"
        class="plan-card"
        @click="goDetail(plan.id)"
      >
        <view class="card-top">
          <view class="icon-wrap" :style="{ background: plan.color + '1a' }">
            <text class="icon-text" :style="{ color: plan.color }">
              {{ typeLabel(plan.type)[0] }}
            </text>
          </view>
          <view class="info">
            <text class="name">{{ plan.name }}</text>
            <text class="meta">
              {{ typeLabel(plan.type)
              }}{{ plan.initialDoneCount ? ` · 起始 ${plan.initialDoneCount}` : '' }}
            </text>
          </view>
          <text class="progress">{{ planMeta(plan) }}</text>
        </view>
        <view class="pbar">
          <view
            class="pbar-fill"
            :style="{
              width: plan.totalCount !== null ? progressText(plan) : '100%',
              background: plan.color,
              opacity: plan.totalCount !== null ? 1 : 0.3,
            }"
          />
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <view class="empty-icon">
        <view class="plus-h" />
        <view class="plus-v" />
      </view>
      <text class="empty-text">还没有计划</text>
      <button class="create-btn" @tap="goCreate">新建计划</button>
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
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 32rpx 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
}
.add-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #1a1a1a;
  position: relative;
  flex-shrink: 0;
}
.add-btn:active {
  opacity: 0.7;
}
/* 十字图标（绝对居中，不依赖字体 baseline） */
.plus-h {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24rpx;
  height: 4rpx;
  background: #fff;
  border-radius: 2rpx;
  transform: translate(-50%, -50%);
}
.plus-v {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4rpx;
  height: 24rpx;
  background: #fff;
  border-radius: 2rpx;
  transform: translate(-50%, -50%);
}
.loading {
  display: flex;
  justify-content: center;
  padding: 120rpx 0;
}
.rows {
  padding: 0 32rpx;
}
.plan-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx 32rpx;
  margin-bottom: 16rpx;
}
.plan-card:active {
  background: #f5f5f5;
}
.card-top {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-text {
  font-size: 32rpx;
  font-weight: 700;
}
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
}
.meta {
  font-size: 24rpx;
  color: #ababab;
}
.progress {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a1a1a;
}
.pbar {
  height: 8rpx;
  background: #f0f0f0;
  border-radius: 4rpx;
  overflow: hidden;
  margin-top: 24rpx;
  margin-left: 96rpx;
}
.pbar-fill {
  height: 100%;
  border-radius: 4rpx;
  transition: width 0.4s ease;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 160rpx 0;
  color: #ababab;
}
.empty-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 4rpx dashed #d0d0d0;
  position: relative;
}
.empty-text {
  font-size: 28rpx;
}
.create-btn {
  width: 240rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: #1a1a1a;
  color: #fff;
  font-size: 28rpx;
  border-radius: 36rpx;
  border: none;
  text-align: center;
  margin: 0;
}
.create-btn::after {
  border: none;
}
</style>
