<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { planApi } from '@/api/plan'
import { usePlanStore } from '@/store/plan'
import { useUserStore } from '@/store/user'
import { statsApi, type PlanProgressData } from '@/api/stats'
import { checkinApi, type CalendarResult } from '@/api/checkin'
import { totalDone } from '@/utils/progress'
import { currentMonth, shiftMonth, monthGrid, formatDate, todayStr } from '@/utils/date'
import type { Plan } from '@promise-checkin/shared'

interface ValuePoint {
  date: string
  value: number
}

const planStore = usePlanStore()
const userStore = useUserStore()
const planId = ref(0)
const plan = ref<Plan | null>(null)
const progressData = ref<PlanProgressData | null>(null)
const calendar = ref<CalendarResult | null>(null)
const valuePoints = ref<ValuePoint[]>([])
const valueUnit = ref<string | null>(null)
const activeTab = ref<'progress' | 'calendar' | 'records'>('progress')
const calMonth = ref(currentMonth())
const loading = ref(true)
const loadError = ref(false)

onLoad((options) => {
  const id = Number(options?.id)
  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1000)
    return
  }
  planId.value = id
})

// onShow 刷新（编辑返回后数据更新）。游客不拉数据（正常流程游客到不了这页，防御性守卫）
onShow(() => {
  if (planId.value && userStore.isLogin) loadData()
})

async function loadData() {
  loading.value = true
  loadError.value = false
  try {
    const [p, prog] = await Promise.all([planApi.get(planId.value), statsApi.progress(planId.value)])
    plan.value = p
    progressData.value = prog
    await loadCalendar()
    if (p.recordValue) {
      await loadValues()
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function loadValues() {
  try {
    const res = await statsApi.values(planId.value, 30)
    valuePoints.value = res.values
    valueUnit.value = res.unit
    // 数据加载后绘制趋势图（等 DOM 更新）
    nextTick(() => drawTrendChart())
  } catch {
    // 趋势图失败不阻塞主流程
  }
}

/** canvas 绘制趋势折线图（带重试：canvas 原生 node 注册可能晚于 nextTick） */
function drawTrendChart(retry = 0) {
  if (!valuePoints.value.length || valuePoints.value.length < 2) return
  const query = uni.createSelectorQuery()
  query
    .select('#trendChart')
    .fields({ node: true, size: true }, () => {}) // 类型定义要求 callback 参数，实际结果统一走 exec
    .exec((res) => {
      if (!res?.[0]?.node) {
        // canvas node 未就绪，延时重试（最多 5 次，每次 100ms）
        if (retry < 5) setTimeout(() => drawTrendChart(retry + 1), 100)
        return
      }
      const w = res[0].width
      const h = res[0].height
      if (!w || !h) {
        if (retry < 5) setTimeout(() => drawTrendChart(retry + 1), 100)
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      const pts = valuePoints.value
      const pad = 16
      const min = Math.min(...pts.map((p) => p.value))
      const max = Math.max(...pts.map((p) => p.value))
      const range = max - min || 1
      const color = plan.value?.color || '#007AFF'

      // 计算坐标点
      const coords = pts.map((p, i) => {
        const x = pad + (i / (pts.length - 1)) * (w - pad * 2)
        const y = h - pad - ((p.value - min) / range) * (h - pad * 2)
        return [x, y] as [number, number]
      })

      // 区域填充
      ctx.beginPath()
      ctx.moveTo(coords[0][0], h - pad)
      coords.forEach(([x, y]) => ctx.lineTo(x, y))
      ctx.lineTo(coords[coords.length - 1][0], h - pad)
      ctx.closePath()
      // 半透明填充（用 rgba）
      ctx.fillStyle = color + '20'
      ctx.fill()

      // 折线
      ctx.beginPath()
      coords.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 数据点
      coords.forEach(([x, y]) => {
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })
    })
}

async function loadCalendar() {
  calendar.value = await checkinApi.calendar(planId.value, calMonth.value)
}

/** 切月份 */
function changeMonth(delta: number) {
  calMonth.value = shiftMonth(calMonth.value, delta)
  loadCalendar()
}

/** 切 Tab（切回进度 Tab 时重绘趋势图，canvas 被 v-if 销毁后内容丢失） */
function setTab(tab: 'progress' | 'calendar' | 'records') {
  activeTab.value = tab
  if (tab === 'progress' && valuePoints.value.length >= 2) {
    nextTick(() => drawTrendChart())
  }
}

/** 某天的打卡状态记录 */
function dayRecords(date: Date) {
  const ds = formatDate(date)
  return calendar.value?.days.filter((c) => c.scheduledDate === ds) ?? []
}

/** 日历格子的状态点 */
function dayDotColor(date: Date): string {
  const records = dayRecords(date)
  if (!records.length) return ''
  const hasDone = records.some((c) => c.status === 'done')
  const hasMissed = records.some((c) => c.status === 'missed')
  if (hasDone) return '#34C759'
  if (hasMissed) return '#FF3B30'
  return '#C7C7CC'
}

/** 编辑 */
function goEdit() {
  uni.navigateTo({ url: `/pages/plan/edit?id=${planId.value}` })
}

/** 删除计划（二次确认后软删除，返回列表页） */
function handleDelete() {
  uni.showModal({
    title: '删除计划',
    content: `确定删除"${plan.value?.name}"吗？可在回收站恢复。`,
    confirmColor: '#FF3B30',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await planStore.deletePlan(planId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch {
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    },
  })
}

/** 今日打卡（找到今天的 pending 记录，标记完成） */
async function handleCheckinToday() {
  const today = todayStr()
  const todayPending = calendar.value?.days.find(
    (c) => c.scheduledDate === today && c.status === 'pending',
  )
  if (!todayPending) {
    uni.showToast({ title: '今天没有待打卡', icon: 'none' })
    return
  }
  try {
    let value: number | undefined
    if (plan.value?.recordValue) {
      const res = await uni.showModal({
        title: '记录数值',
        editable: true,
        placeholderText: `请输入数值${plan.value.valueUnit ? `（${plan.value.valueUnit}）` : ''}`,
        confirmText: '打卡',
      })
      if (!res.confirm) return
      value = parseFloat(res.content || '')
      if (isNaN(value)) {
        uni.showToast({ title: '请输入有效数值', icon: 'none' })
        return
      }
    }
    await checkinApi.upsert(planId.value, {
      scheduledDate: today,
      scheduledTime: todayPending.scheduledTime,
      status: 'done',
      value,
    })
    uni.showToast({ title: '已打卡', icon: 'success' })
    loadData()
  } catch {
    uni.showToast({ title: '打卡失败', icon: 'none' })
  }
}

/** 补卡（缺席记录 → 转为已完成） */
async function handleMakeup(checkinId: number, scheduledDate: string, scheduledTime: string | null) {
  uni.showModal({
    title: '补卡',
    content: '确认补记为已完成？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await checkinApi.retroactive(planId.value, { scheduledDate, scheduledTime })
        uni.showToast({ title: '已补卡', icon: 'success' })
        loadData()
      } catch {
        uni.showToast({ title: '补卡失败', icon: 'none' })
      }
    },
  })
}

/** 判断今天是否有待打卡（控制打卡按钮显隐） */
const hasTodayPending = computed(() => {
  const today = todayStr()
  return calendar.value?.days.some((c) => c.scheduledDate === today && c.status === 'pending') ?? false
})

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

const grid = computed(() => monthGrid(calMonth.value))
const missedRecords = computed(
  () => calendar.value?.days.filter((c) => c.status === 'missed') ?? [],
)
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">
      <wd-loading />
    </view>

    <view v-else-if="loadError" class="error-state">
      <text class="error-text">加载失败</text>
      <button class="retry-btn" @tap="loadData">重试</button>
    </view>

    <template v-else-if="plan && progressData">
      <!-- 摘要区 + 操作按钮 -->
      <view class="summary">
        <view class="s-icon" :style="{ background: plan.color + '1a' }">
          <text :style="{ color: plan.color }">{{ typeLabel(plan.type)[0] }}</text>
        </view>
        <text class="s-name">{{ plan.name }}</text>
        <text class="s-meta">
          {{ typeLabel(plan.type) }}{{ plan.remark ? ` · ${plan.remark}` : '' }}
        </text>
      </view>

      <!-- 操作按钮区 -->
      <view class="action-bar">
        <button v-if="hasTodayPending" class="action-btn primary" @tap="handleCheckinToday">今日打卡</button>
        <button class="action-btn ghost" @tap="goEdit">编辑</button>
        <button class="action-btn danger" @tap="handleDelete">删除</button>
      </view>

      <!-- Tab -->
      <view class="tabs">
        <text class="tab" :class="{ active: activeTab === 'progress' }" @click="setTab('progress')">进度</text>
        <text class="tab" :class="{ active: activeTab === 'calendar' }" @click="setTab('calendar')">日历</text>
        <text class="tab" :class="{ active: activeTab === 'records' }" @click="setTab('records')">记录</text>
      </view>

      <!-- 进度 Tab -->
      <view v-if="activeTab === 'progress'" class="tab-content">
        <view class="stats-grid">
          <view class="stat">
            <text class="num done">{{ totalDone(plan) }}</text>
            <text class="lbl">已完成</text>
            <text v-if="plan.initialDoneCount" class="extra">含起始 {{ plan.initialDoneCount }}</text>
          </view>
          <view class="stat">
            <text class="num missed">{{ plan.missedCount }}</text>
            <text class="lbl">缺席</text>
          </view>
          <template v-if="plan.totalCount !== null">
            <view class="stat">
              <text class="num">{{ progressData.consumed }}/{{ plan.totalCount }}</text>
              <text class="lbl">已消耗</text>
              <text class="extra">{{ plan.absenceConsumes ? '含缺席' : '仅完成' }}</text>
            </view>
            <view class="stat">
              <text class="num" :style="{ color: plan.color }">{{ progressData.remain }}</text>
              <text class="lbl">剩余</text>
            </view>
          </template>
          <template v-else>
            <view class="stat">
              <text class="num muted">∞</text>
              <text class="lbl">无限计划</text>
            </view>
            <view class="stat">
              <text class="num">{{ progressData.streak }}</text>
              <text class="lbl">连续天数</text>
            </view>
          </template>
        </view>

        <view class="info-card">
          <view class="info-row">
            <text class="info-lbl">连续打卡</text>
            <text class="info-val">{{ progressData.streak }} 天</text>
          </view>
          <view class="info-row">
            <text class="info-lbl">完成率</text>
            <text class="info-val">
              {{ progressData.completionRate !== null ? Math.round(progressData.completionRate * 100) + '%' : '—' }}
            </text>
          </view>
          <view v-if="progressData.estimatedEndDate" class="info-row">
            <text class="info-lbl">预计完成</text>
            <text class="info-val">{{ progressData.estimatedEndDate }}</text>
          </view>
        </view>

        <!-- 数值趋势图（recordValue 计划才显示） -->
        <view v-if="plan.recordValue && valuePoints.length >= 2" class="trend-card">
          <view class="trend-head">
            <text class="trend-title">近 {{ valuePoints.length }} 次趋势</text>
            <text v-if="valueUnit" class="trend-unit">{{ valueUnit }}</text>
          </view>
          <canvas
            id="trendChart"
            type="2d"
            class="trend-canvas"
          />
          <view class="trend-range">
            <text>最低 {{ Math.min(...valuePoints.map((p) => p.value)) }}</text>
            <text>最高 {{ Math.max(...valuePoints.map((p) => p.value)) }}</text>
          </view>
        </view>

        <view class="edit-entry" @click="goEdit">编辑计划</view>
      </view>

      <!-- 日历 Tab -->
      <view v-if="activeTab === 'calendar'" class="tab-content">
        <view class="cal-card">
          <view class="cal-head">
            <text class="cal-arrow" @click="changeMonth(-1)">‹</text>
            <text class="cal-month">{{ calMonth }}</text>
            <text class="cal-arrow" @click="changeMonth(1)">›</text>
          </view>
          <view class="cal-dow">
            <text v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="dow">{{ w }}</text>
          </view>
          <view class="cal-grid">
            <view v-for="(date, i) in grid" :key="i" class="cal-cell" :class="{ empty: !date, today: date && formatDate(date) === todayStr() }">
              <template v-if="date">
                <text class="cell-date">{{ date.getDate() }}</text>
                <view v-if="dayDotColor(date)" class="cell-dot" :style="{ background: dayDotColor(date) }" />
              </template>
            </view>
          </view>
        </view>
        <view class="legend">
          <view class="legend-item"><view class="leg-dot" style="background: #34c759" /><text>完成</text></view>
          <view class="legend-item"><view class="leg-dot" style="background: #ff3b30" /><text>缺席</text></view>
          <view class="legend-item"><view class="leg-dot" style="background: #c7c7cc" /><text>待打</text></view>
        </view>
      </view>

      <!-- 记录 Tab -->
      <view v-if="activeTab === 'records'" class="tab-content">
        <view v-if="missedRecords.length" class="records-list">
          <view v-for="r in missedRecords" :key="r.id" class="record-item">
            <view class="rec-dot missed" />
            <view class="rec-main">
              <text class="rec-date">{{ r.scheduledDate }} {{ r.scheduledTime || '' }}</text>
              <text class="rec-remark">{{ r.remark || '无备注' }}</text>
            </view>
            <text v-if="r.adjustmentType === 'makeup'" class="rec-tag makeup">已补</text>
            <template v-else>
              <button class="makeup-btn" @tap="handleMakeup(r.id, r.scheduledDate, r.scheduledTime)">补卡</button>
            </template>
          </view>
        </view>
        <view v-else class="empty-records">
          <text>暂无缺席记录</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding-bottom: 40rpx;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 200rpx 0;
}
.summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx 40rpx;
}
.s-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
}
.s-name {
  font-size: 40rpx;
  font-weight: 700;
  margin-top: 16rpx;
}
.s-meta {
  font-size: 24rpx;
  color: #ababab;
  margin-top: 8rpx;
}
.action-bar {
  display: flex;
  gap: 16rpx;
  padding: 0 32rpx 24rpx;
}
.action-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
  border-radius: 16rpx;
  border: none;
  text-align: center;
  margin: 0;
}
.action-btn::after { border: none; }
.action-btn.primary {
  background: #1a1a1a;
  color: #fff;
}
.action-btn.ghost {
  background: #f5f5f5;
  color: #6b6b6b;
}
.action-btn.danger {
  background: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
}
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 200rpx 0;
}
.error-text {
  font-size: 28rpx;
  color: #ababab;
}
.retry-btn {
  width: 200rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: #f5f5f5;
  color: #1a1a1a;
  font-size: 28rpx;
  border-radius: 16rpx;
  border: none;
}
.retry-btn::after { border: none; }
.makeup-btn {
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  background: #1a1a1a;
  color: #fff;
  border-radius: 20rpx;
  border: none;
  line-height: 1.5;
  margin: 0;
}
.makeup-btn::after { border: none; }
.tabs {
  display: flex;
  margin: 0 32rpx;
  border-bottom: 1rpx solid #efefef;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #ababab;
  font-weight: 500;
}
.tab.active {
  color: #1a1a1a;
  font-weight: 600;
}
.tab-content {
  padding: 32rpx;
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rpx;
  background: #f5f5f5;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}
.stat {
  background: #fff;
  padding: 32rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.num {
  font-size: 48rpx;
  font-weight: 700;
}
.num.done {
  color: #34c759;
}
.num.missed {
  color: #ff3b30;
}
.num.muted {
  color: #ababab;
}
.lbl {
  font-size: 24rpx;
  color: #ababab;
}
.extra {
  font-size: 22rpx;
  color: #ababab;
}
.info-card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.info-row:last-child {
  border-bottom: none;
}
.info-lbl {
  font-size: 28rpx;
}
.info-val {
  font-size: 32rpx;
  font-weight: 600;
}
.edit-entry {
  text-align: center;
  padding: 32rpx;
  font-size: 28rpx;
  color: #ababab;
}
.trend-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}
.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.trend-title {
  font-size: 28rpx;
  font-weight: 500;
}
.trend-unit {
  font-size: 24rpx;
  color: #ababab;
}
.trend-canvas {
  width: 100%;
  height: 200rpx;
}
.trend-range {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #ababab;
}
.cal-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
}
.cal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}
.cal-arrow {
  font-size: 40rpx;
  color: #ababab;
  padding: 0 24rpx;
}
.cal-month {
  font-size: 30rpx;
  font-weight: 600;
}
.cal-dow {
  display: flex;
}
.dow {
  flex: 1;
  text-align: center;
  font-size: 22rpx;
  color: #ababab;
  padding: 16rpx 0;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4rpx;
}
.cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  gap: 4rpx;
}
.cal-cell.today {
  background: #1a1a1a;
  .cell-date {
    color: #fff;
    font-weight: 700;
  }
}
.cal-cell.empty {
  background: transparent;
}
.cell-date {
  font-size: 26rpx;
}
.cell-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
}
.legend {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  padding: 32rpx 0;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  color: #ababab;
}
.leg-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}
.records-list {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}
.record-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.record-item:last-child {
  border-bottom: none;
}
.rec-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}
.rec-dot.missed {
  background: #ff3b30;
}
.rec-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.rec-date {
  font-size: 28rpx;
  font-weight: 500;
}
.rec-remark {
  font-size: 24rpx;
  color: #ababab;
}
.rec-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.rec-tag.makeup {
  background: rgba(175, 82, 222, 0.1);
  color: #af52de;
}
.rec-tag.missed-tag {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}
.empty-records {
  text-align: center;
  padding: 120rpx 0;
  color: #ababab;
  font-size: 28rpx;
}
</style>
