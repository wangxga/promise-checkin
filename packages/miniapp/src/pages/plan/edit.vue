<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePlanStore } from '@/store/plan'
import { planApi, type CreatePlanParams } from '@/api/plan'
import { todayStr } from '@/utils/date'
import type { PlanType, TimeMode } from '@promise-checkin/shared'

const planStore = usePlanStore()
const editId = ref(0)
const isEdit = computed(() => editId.value > 0)
const step = ref(0)
const submitting = ref(false)

// 表单状态
const form = reactive({
  name: '',
  type: 'course' as PlanType,
  color: '#007AFF',
  totalCountMode: 'limited', // limited / unlimited
  totalCount: 60,
  initialDoneCount: 0,
  absenceConsumes: false,
  timeMode: 'fixed' as TimeMode,
  scheduleType: 'weekday', // weekday / everyday
  weekdays: [2, 6] as number[],
  times: ['18:00'],
  everydayTimes: ['08:00'],
  overdueHandling: 'keep_pending' as 'keep_pending' | 'auto_missed',
  overdueGraceHours: 24,
  recordValue: false,
  valueUnit: '',
  startDate: todayStr(),
  remark: '',
})

const TYPES = [
  { value: 'course', label: '课程' },
  { value: 'medicine', label: '服药' },
  { value: 'measure', label: '测量' },
  { value: 'fitness', label: '运动' },
  { value: 'learning', label: '学习' },
  { value: 'custom', label: '自定义' },
]
const COLORS = ['#1a1a1a', '#34C759', '#007AFF', '#AF52DE', '#FF3B30', '#FF9500', '#5856D6', '#00C7BE']
const WEEKDAYS = [
  { v: 1, l: '一' },
  { v: 2, l: '二' },
  { v: 3, l: '三' },
  { v: 4, l: '四' },
  { v: 5, l: '五' },
  { v: 6, l: '六' },
  { v: 7, l: '日' },
]

onLoad(async (options) => {
  if (options?.id) {
    editId.value = Number(options.id)
    await loadPlan()
  }
})

async function loadPlan() {
  try {
    const p = await planApi.get(editId.value)
    form.name = p.name
    form.type = p.type as PlanType
    form.color = p.color
    form.totalCountMode = p.totalCount === null ? 'unlimited' : 'limited'
    form.totalCount = p.totalCount ?? 60
    form.initialDoneCount = p.initialDoneCount
    form.absenceConsumes = p.absenceConsumes
    form.timeMode = p.timeMode as TimeMode
    form.overdueHandling = p.overdueHandling as 'keep_pending' | 'auto_missed'
    form.overdueGraceHours = p.overdueGraceHours
    form.recordValue = p.recordValue
    form.valueUnit = p.valueUnit ?? ''
    form.startDate = p.startDate ?? todayStr()
    form.remark = p.remark ?? ''
    // 反解 scheduleConfig（安全判断：用 every 而非 rules[0]，过滤无 weekday 的规则）
    if (p.scheduleConfig?.rules?.length) {
      const rules = p.scheduleConfig.rules
      if (rules.every((r) => 'weekday' in r)) {
        form.scheduleType = 'weekday'
        form.weekdays = [...new Set(rules.map((r) => r.weekday).filter((w): w is number => w != null))]
        form.times = [...new Set(rules.map((r) => r.time))]
      } else {
        form.scheduleType = 'everyday'
        form.everydayTimes = [...new Set(rules.map((r) => r.time))]
      }
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function toggleWeekday(w: number) {
  const idx = form.weekdays.indexOf(w)
  if (idx >= 0) form.weekdays.splice(idx, 1)
  else form.weekdays.push(w)
  form.weekdays.sort((a, b) => a - b)
}

function addTime() {
  form.times.push('18:00')
}
function removeTime(i: number) {
  form.times.splice(i, 1)
}
function addEverydayTime() {
  form.everydayTimes.push('20:00')
}
function removeEverydayTime(i: number) {
  form.everydayTimes.splice(i, 1)
}

/** 构建 scheduleConfig */
function buildScheduleConfig(): CreatePlanParams['scheduleConfig'] {
  if (form.timeMode !== 'fixed') return null
  if (form.scheduleType === 'weekday') {
    const rules: Array<{ weekday: number; time: string }> = []
    for (const w of form.weekdays) for (const t of form.times) rules.push({ weekday: w, time: t })
    return { rules }
  }
  return { rules: form.everydayTimes.map((t) => ({ every: 'day', time: t })) }
}

/** 校验并提交 */
async function submit() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请填写计划名称', icon: 'none' })
    step.value = 0
    return
  }
  // 处理 v-model.number 清空后变成空字符串的情况
  if (form.totalCountMode === 'limited') {
    if (!Number.isFinite(form.totalCount) || form.totalCount <= 0) {
      uni.showToast({ title: '请填写有效的总次数', icon: 'none' })
      step.value = 1
      return
    }
    if (!Number.isFinite(form.initialDoneCount) || form.initialDoneCount < 0) {
      form.initialDoneCount = 0
    }
    if (form.initialDoneCount > form.totalCount) {
      uni.showToast({ title: '起始进度不能超过总次数', icon: 'none' })
      step.value = 1
      return
    }
  }
  if (form.timeMode === 'fixed') {
    if (form.scheduleType === 'weekday' && !form.weekdays.length) {
      uni.showToast({ title: '请选择每周哪几天', icon: 'none' })
      step.value = 2
      return
    }
    if (form.scheduleType === 'weekday' && !form.times.length) {
      uni.showToast({ title: '请添加时间', icon: 'none' })
      step.value = 2
      return
    }
    if (form.scheduleType === 'everyday' && !form.everydayTimes.length) {
      uni.showToast({ title: '请添加时间', icon: 'none' })
      step.value = 2
      return
    }
  }

  const params: CreatePlanParams = {
    name: form.name.trim(),
    type: form.type,
    color: form.color,
    totalCount: form.totalCountMode === 'unlimited' ? null : form.totalCount,
    initialDoneCount: form.totalCountMode === 'limited' ? form.initialDoneCount : 0,
    absenceConsumes: form.absenceConsumes,
    timeMode: form.timeMode,
    scheduleConfig: buildScheduleConfig(),
    overdueHandling: form.overdueHandling,
    overdueGraceHours: form.overdueGraceHours,
    recordValue: form.recordValue,
    valueUnit: form.recordValue ? form.valueUnit : null,
    startDate: form.startDate,
    remark: form.remark || null,
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await planApi.update(editId.value, params)
      uni.showToast({ title: '已保存', icon: 'success' })
    } else {
      await planStore.createPlan(params)
      uni.showToast({ title: '已创建', icon: 'success' })
    }
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function next() {
  if (step.value < 3) step.value++
}
function prev() {
  if (step.value > 0) step.value--
}
</script>

<template>
  <view class="page">
    <!-- 步骤指示 -->
    <view class="steps">
      <view v-for="i in 4" :key="i" class="step-bar" :class="{ cur: i - 1 <= step }" />
    </view>

    <!-- Step 1: 基本信息 -->
    <view v-if="step === 0" class="card">
      <view class="field">
        <text class="label">计划名称</text>
        <input v-model="form.name" class="input" placeholder="如：钢琴课、每日维生素" />
      </view>
      <view class="field">
        <text class="label">类型</text>
        <view class="opts">
          <view
            v-for="t in TYPES"
            :key="t.value"
            class="opt"
            :class="{ sel: form.type === t.value }"
            @click="form.type = t.value as PlanType"
          >
            {{ t.label }}
          </view>
        </view>
      </view>
      <view class="field">
        <text class="label">主题色</text>
        <view class="colors">
          <view
            v-for="c in COLORS"
            :key="c"
            class="color-opt"
            :class="{ sel: form.color === c }"
            :style="{ background: c }"
            @click="form.color = c"
          />
        </view>
      </view>
    </view>

    <!-- Step 2: 次数与配额 -->
    <view v-if="step === 1" class="card">
      <view class="field">
        <text class="label">次数</text>
        <view class="opts">
          <view class="opt" :class="{ sel: form.totalCountMode === 'limited' }" @click="form.totalCountMode = 'limited'">有限次数</view>
          <view class="opt" :class="{ sel: form.totalCountMode === 'unlimited' }" @click="form.totalCountMode = 'unlimited'">无限次</view>
        </view>
      </view>
      <template v-if="form.totalCountMode === 'limited'">
        <view class="field">
          <text class="label">总次数</text>
          <input v-model.number="form.totalCount" type="number" class="input" />
        </view>
        <view class="field">
          <text class="label">起始进度</text>
          <input v-model.number="form.initialDoneCount" type="number" class="input" />
          <text class="hint">如果这个计划已经开始过，填入之前已完成的次数。只影响进度展示，不补造历史记录。</text>
        </view>
        <view class="field">
          <text class="label">缺勤是否计入配额消耗</text>
          <view class="switch-row">
            <text class="switch-hint">开启后缺席也扣配额，关闭则只按实际完成计</text>
            <switch :checked="form.absenceConsumes" @change="form.absenceConsumes = $event.detail.value" />
          </view>
        </view>
      </template>
      <view class="field">
        <text class="label">逾期处理</text>
        <view class="opts">
          <view class="opt" :class="{ sel: form.overdueHandling === 'keep_pending' }" @click="form.overdueHandling = 'keep_pending'">保留待处理</view>
          <view class="opt" :class="{ sel: form.overdueHandling === 'auto_missed' }" @click="form.overdueHandling = 'auto_missed'">自动标记缺席</view>
        </view>
      </view>
      <view v-if="form.overdueHandling === 'auto_missed'" class="field">
        <text class="label">宽限期（小时）</text>
        <input v-model.number="form.overdueGraceHours" type="number" class="input" />
      </view>
      <view class="field">
        <text class="label">开始日期</text>
        <picker mode="date" :value="form.startDate" @change="form.startDate = $event.detail.value">
          <view class="picker-val">{{ form.startDate }}</view>
        </picker>
      </view>
    </view>

    <!-- Step 3: 时间模式 -->
    <view v-if="step === 2" class="card">
      <view class="field">
        <text class="label">时间模式</text>
        <view class="opts">
          <view class="opt" :class="{ sel: form.timeMode === 'fixed' }" @click="form.timeMode = 'fixed' as TimeMode">固定排期</view>
          <view class="opt" :class="{ sel: form.timeMode === 'flexible' }" @click="form.timeMode = 'flexible' as TimeMode">不固定</view>
        </view>
      </view>
      <template v-if="form.timeMode === 'fixed'">
        <view class="field">
          <text class="label">排期方式</text>
          <view class="opts">
            <view class="opt" :class="{ sel: form.scheduleType === 'weekday' }" @click="form.scheduleType = 'weekday'">按周几</view>
            <view class="opt" :class="{ sel: form.scheduleType === 'everyday' }" @click="form.scheduleType = 'everyday'">每天定时</view>
          </view>
        </view>
        <view v-if="form.scheduleType === 'weekday'" class="field">
          <text class="label">每周哪几天</text>
          <view class="opts">
            <view
              v-for="w in WEEKDAYS"
              :key="w.v"
              class="opt small"
              :class="{ sel: form.weekdays.includes(w.v) }"
              @click="toggleWeekday(w.v)"
            >
              {{ w.l }}
            </view>
          </view>
        </view>
        <view v-if="form.scheduleType === 'weekday'" class="field">
          <text class="label">时间</text>
          <view v-for="(t, i) in form.times" :key="t + '-' + i" class="time-row">
            <picker mode="time" :value="t" @change="form.times[i] = $event.detail.value">
              <view class="picker-val time">{{ t }}</view>
            </picker>
            <view v-if="form.times.length > 1" class="rm-btn" @click="removeTime(i)">✕</view>
          </view>
          <view class="add-btn" @click="addTime">+ 添加时间</view>
        </view>
        <view v-if="form.scheduleType === 'everyday'" class="field">
          <text class="label">每天几个时间点</text>
          <view v-for="(t, i) in form.everydayTimes" :key="t + '-' + i" class="time-row">
            <picker mode="time" :value="t" @change="form.everydayTimes[i] = $event.detail.value">
              <view class="picker-val time">{{ t }}</view>
            </picker>
            <view v-if="form.everydayTimes.length > 1" class="rm-btn" @click="removeEverydayTime(i)">✕</view>
          </view>
          <view class="add-btn" @click="addEverydayTime">+ 添加时间</view>
        </view>
      </template>
      <view v-else class="hint-box">不固定模式下随时手动打卡，系统不预生成排期。</view>

      <view class="field">
        <text class="label">记录数值</text>
        <view class="switch-row">
          <text class="switch-hint">每次打卡可记录一个数值（如血压、背诵量）</text>
          <switch :checked="form.recordValue" @change="form.recordValue = $event.detail.value" />
        </view>
      </view>
      <view v-if="form.recordValue" class="field">
        <text class="label">数值单位</text>
        <input v-model="form.valueUnit" class="input" placeholder="如 mmHg、个、ml" />
      </view>
    </view>

    <!-- Step 4: 备注 -->
    <view v-if="step === 3" class="card">
      <view class="field">
        <text class="label">备注（可选）</text>
        <textarea
          v-model="form.remark"
          class="textarea"
          placeholder="如老师、地点、单价、注意事项..."
        />
      </view>
    </view>

    <!-- 导航按钮 -->
    <view class="nav">
      <view v-if="step > 0" class="nav-btn ghost" @click="prev">上一步</view>
      <view v-if="step < 3" class="nav-btn fill" @click="next">下一步</view>
      <view v-else class="nav-btn fill" :class="{ disabled: submitting }" @click="submit">
        {{ submitting ? '提交中...' : isEdit ? '保存' : '创建计划' }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 16rpx 32rpx 80rpx;
}
.steps {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 0 32rpx;
}
.step-bar {
  flex: 1;
  height: 6rpx;
  background: #efefef;
  border-radius: 3rpx;
}
.step-bar.cur {
  background: #1a1a1a;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 16rpx 32rpx;
}
.field {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.field:last-child {
  border-bottom: none;
}
.label {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  margin-bottom: 16rpx;
}
.input {
  width: 100%;
  padding: 20rpx 24rpx;
  background: #f9f9f9;
  border-radius: 16rpx;
  font-size: 28rpx;
}
.textarea {
  width: 100%;
  height: 160rpx;
  padding: 20rpx 24rpx;
  background: #f9f9f9;
  border-radius: 16rpx;
  font-size: 28rpx;
}
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.opt {
  flex: 1;
  min-width: 160rpx;
  padding: 20rpx;
  text-align: center;
  border: 2rpx solid #efefef;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #6b6b6b;
}
.opt.small {
  min-width: 0;
  flex: 0 0 calc(14% - 8rpx);
  padding: 16rpx 0;
}
.opt.sel {
  border-color: #1a1a1a;
  background: #1a1a1a;
  color: #fff;
  font-weight: 500;
}
.colors {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 16rpx;
}
.color-opt {
  aspect-ratio: 1;
  border-radius: 16rpx;
  border: 4rpx solid transparent;
}
.color-opt.sel {
  border-color: #1a1a1a;
}
.hint {
  display: block;
  font-size: 24rpx;
  color: #ababab;
  margin-top: 12rpx;
  line-height: 1.6;
}
.hint-box {
  padding: 24rpx;
  background: #f9f9f9;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: #ababab;
  line-height: 1.6;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}
.switch-hint {
  flex: 1;
  font-size: 24rpx;
  color: #ababab;
}
.picker-val {
  padding: 20rpx 24rpx;
  background: #f9f9f9;
  border-radius: 16rpx;
  font-size: 28rpx;
}
.picker-val.time {
  width: 200rpx;
}
.time-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.rm-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ababab;
  font-size: 28rpx;
}
.add-btn {
  display: inline-block;
  padding: 12rpx 24rpx;
  background: #f5f5f5;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: #6b6b6b;
  margin-top: 8rpx;
}
.nav {
  display: flex;
  gap: 16rpx;
  padding: 40rpx 0;
}
.nav-btn {
  flex: 1;
  text-align: center;
  padding: 28rpx;
  border-radius: 20rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.nav-btn.ghost {
  background: #f5f5f5;
  color: #6b6b6b;
}
.nav-btn.fill {
  background: #1a1a1a;
  color: #fff;
}
.nav-btn.disabled {
  opacity: 0.5;
}
</style>
