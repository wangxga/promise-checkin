<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCheckinStore } from '@/store/checkin'
import { useUserStore } from '@/store/user'

const checkinStore = useCheckinStore()
const userStore = useUserStore()
const loading = computed(() => checkinStore.loading)
const authChecked = ref(false) // 登录验证完成前不渲染业务内容
const submittingId = ref(0) // 正在打卡的 checkinId，防重复点击

onShow(async () => {
  authChecked.value = false
  // 先检查登录态，未登录跳 login（此时页面只显示空白，看不到任何业务内容）
  const ok = await userStore.checkLogin()
  if (!ok) return
  authChecked.value = true
  checkinStore.fetchOverview()
})

/** 一键打卡（recordValue 计划先弹数值输入） */
async function handleQuickDone(
  checkinId: number,
  planId: number,
  scheduledDate: string,
  scheduledTime: string | null,
  recordValue?: boolean,
  valueUnit?: string | null,
) {
  if (submittingId.value) return // 防重复点击
  submittingId.value = checkinId
  try {
    let value: number | undefined
    // recordValue 计划：先弹数值输入
    if (recordValue) {
      const res = await uni.showModal({
        title: '记录数值',
        editable: true,
        placeholderText: `请输入数值${valueUnit ? `（${valueUnit}）` : ''}`,
        confirmText: '打卡',
      })
      if (!res.confirm) return // 用户取消
      const inputVal = parseFloat(res.content || '')
      if (isNaN(inputVal)) {
        uni.showToast({ title: '请输入有效数值', icon: 'none' })
        return
      }
      value = inputVal
    }
    await checkinStore.quickDone(planId, scheduledDate, scheduledTime, value)
    uni.showToast({ title: '已打卡', icon: 'success' })
    if (uni.vibrateShort) uni.vibrateShort({ type: 'light' })
  } catch {
    uni.showToast({ title: '打卡失败', icon: 'none' })
  } finally {
    submittingId.value = 0
  }
}

/** 跳缺席列表 */
function goMissed() {
  uni.navigateTo({ url: '/pages/stats/missed' })
}
</script>

<template>
  <view class="page">
    <!-- 登录验证完成前显示空白，防止未登录用户看到业务内容 -->
    <view v-if="!authChecked" class="auth-loading" />

    <template v-else>
    <!-- 今日待办 -->
    <view class="section-label">
      <text>今日待办</text>
      <text class="count">{{ checkinStore.overview?.todayTodo ?? 0 }} 项待打</text>
    </view>

    <view v-if="loading && !checkinStore.overview" class="loading">
      <wd-loading />
    </view>

    <template v-else>
      <view v-if="checkinStore.overview?.todayTodoList.length" class="rows">
        <view
          v-for="item in checkinStore.overview.todayTodoList"
          :key="item.checkinId"
          class="row"
          @click="handleQuickDone(item.checkinId, item.planId, item.scheduledDate, item.scheduledTime, item.recordValue, item.valueUnit)"
        >
          <view class="dot" :style="{ background: item.planColor }" />
          <view class="main">
            <text class="name">{{ item.planName }}</text>
            <text class="sub">
              {{ item.scheduledTime || '待打卡' }}{{ item.recordValue ? `（记录${item.valueUnit || '数值'}）` : '' }}
            </text>
          </view>
          <button
            class="checkin-btn"
            :disabled="submittingId === item.checkinId"
            @click.stop="handleQuickDone(item.checkinId, item.planId, item.scheduledDate, item.scheduledTime, item.recordValue, item.valueUnit)"
          >
            {{ submittingId === item.checkinId ? '...' : '打卡' }}
          </button>
        </view>
      </view>

      <view v-else class="empty">
        <view class="check-icon">✓</view>
        <text class="empty-text">今天没有待打卡</text>
      </view>

      <!-- 已完成 -->
      <view v-if="checkinStore.overview?.todayDoneList.length" class="section-label">
        <text>已完成</text>
        <text class="count">{{ checkinStore.overview.todayDone }} 项</text>
      </view>
      <view v-if="checkinStore.overview?.todayDoneList.length" class="rows">
        <view
          v-for="item in checkinStore.overview.todayDoneList"
          :key="item.checkinId"
          class="row done"
        >
          <view class="dot done-dot" />
          <view class="main">
            <text class="name">{{ item.planName }}</text>
            <text class="sub">{{ item.scheduledTime || '' }} · 已完成</text>
          </view>
          <text class="tag-done">已完成</text>
        </view>
      </view>

      <!-- 缺席入口 -->
      <view v-if="(checkinStore.overview?.weekMissed ?? 0) > 0" class="missed-entry">
        <wd-button type="text" block @click="goMissed">
          查看 {{ checkinStore.overview?.weekMissed }} 条缺席记录
        </wd-button>
      </view>
    </template>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 0 0 40rpx;
}
.checkin-btn {
  flex-shrink: 0;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
  background: #34c759;
  color: #fff;
  border-radius: 28rpx;
  border: none;
  margin: 0;
}
.checkin-btn::after { border: none; }
.checkin-btn[disabled] {
  opacity: 0.5;
  background: #34c759;
  color: #fff;
}
.auth-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #fafafa;
  z-index: 999;
}
.section-label {
  display: flex;
  justify-content: space-between;
  padding: 40rpx 32rpx 20rpx;
  font-size: 26rpx;
  color: #ababab;
  font-weight: 500;
}
.count {
  font-size: 24rpx;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 120rpx 0;
}
.rows {
  padding: 0 32rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  background: #fff;
  border-radius: 24rpx;
  margin-bottom: 16rpx;
}
.row:active {
  background: #f5f5f5;
}
.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  flex-shrink: 0;
}
.done-dot {
  background: #34c759;
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
.row.done {
  opacity: 0.55;
}
.tag-done {
  font-size: 24rpx;
  color: #34c759;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
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
.missed-entry {
  padding: 32rpx;
}
</style>
